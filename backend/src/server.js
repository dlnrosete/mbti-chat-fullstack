const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "change_me";

function authMiddleware(req,res,next){
  const h = req.headers.authorization;
  if(!h){ return res.status(401).json({error:"Missing auth"}); }
  const parts = h.split(" ");
  if(parts.length!==2) return res.status(401).json({error:"Bad auth"});
  const token = parts[1];
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  }catch(e){ return res.status(401).json({error:"Invalid token"}); }
}

// --- Auth ---
app.post("/auth/signup", async (req,res)=>{
  const { username, password, email, mbti, avatar, secondary } = req.body;
  if(!username || !password) return res.status(400).json({error:"username + password required"});
  const uname = username.toLowerCase();
  // check deleted username reservation
  const du = await prisma.deletedUsername.findUnique({where:{username:uname}});
  if(du) return res.status(400).json({error:"username previously used and reserved"});
  const existing = await prisma.user.findUnique({where:{username:uname}});
  if(existing) return res.status(400).json({error:"username taken"});
  const hash = await bcrypt.hash(password, 10);
  const ip = req.ip || req.headers['x-forwarded-for'] || "";
  const user = await prisma.user.create({data:{username:uname,passwordHash:hash,email:email||"",mbti:mbti||null,avatar:avatar||"Cat",secondary:secondary||"",authIp:ip}});
  const token = jwt.sign({userId:user.id}, JWT_SECRET, {expiresIn:"7d"});
  res.json({token});
});

app.post("/auth/login", async (req,res)=>{
  const { username, password } = req.body;
  if(!username||!password) return res.status(400).json({error:"missing"});
  const uname = username.toLowerCase();
  const user = await prisma.user.findUnique({where:{username:uname}});
  if(!user) return res.status(400).json({error:"no such user"});
  // check ban
  const ban = await prisma.ban.findUnique({where:{userId:user.id}});
  if(ban && new Date(ban.until) > new Date()) return res.status(403).json({error:`banned until ${ban.until}`});
  const ok = await bcrypt.compare(password, user.passwordHash);
  if(!ok) return res.status(400).json({error:"wrong password"});
  const token = jwt.sign({userId:user.id}, JWT_SECRET, {expiresIn:"7d"});
  res.json({token});
});

app.get("/me", authMiddleware, async (req,res)=>{
  const user = await prisma.user.findUnique({where:{id:req.userId}, select:{id:true,username:true,secondary:true,mbti:true,avatar:true,statusPoints:true,createdAt:true}});
  if(!user) return res.status(404).json({error:"not found"});
  res.json(user);
});

// --- Lobbies ---
app.get("/lobbies", async (req,res)=>{
  const l = await prisma.lobby.findMany({include:{members:{include:{user:true}}}});
  const out = l.map(x=>({id:x.id,title:x.title,ownerId:x.ownerId,ownerUsername:x.ownerId,capacity:x.capacity,private:x.private}));
  res.json(out);
});
app.post("/lobbies/create", authMiddleware, async (req,res)=>{
  const { title, capacity, private } = req.body;
  const lobby = await prisma.lobby.create({data:{title:title||"Lobby",ownerId:req.userId,capacity:capacity||4,private:private||false}});
  await prisma.lobbyMember.create({data:{lobbyId:lobby.id,userId:req.userId}});
  res.json(lobby);
});

// --- Friends ---
app.post("/users/friend-request", authMiddleware, async (req,res)=>{
  const { targetUsername } = req.body;
  const t = await prisma.user.findUnique({where:{username:targetUsername.toLowerCase()}});
  if(!t) return res.status(404).json({error:"no such user"});
  // create a Friend with a flag? For simplicity create Friend records both sides on accept endpoint.
  // store a simple friend request table could be added; we'll store in-memory? For now respond ok.
  res.json({ok:true});
});
app.post("/users/friend-accept", authMiddleware, async (req,res)=>{
  const { requesterUsername } = req.body;
  const r = await prisma.user.findUnique({where:{username:requesterUsername.toLowerCase()}});
  if(!r) return res.status(404).json({error:"no such user"});
  // create friendship both ways
  await prisma.friend.create({data:{userId:req.userId,friendId:r.id}});
  await prisma.friend.create({data:{userId:r.id,friendId:req.userId}});
  res.json({ok:true});
});

// --- Reporting ---
app.post("/users/report", authMiddleware, async (req,res)=>{
  const { targetUsername } = req.body;
  const target = await prisma.user.findUnique({where:{username:targetUsername.toLowerCase()}});
  if(!target) return res.status(404).json({error:"no such user"});
  if(target.id === req.userId) return res.status(400).json({error:"can't report yourself"});
  // check if reporter already reported this target
  const already = await prisma.report.findFirst({where:{reporterId:req.userId,targetId:target.id}});
  if(already) return res.status(400).json({error:"already reported"});
  const ip = req.ip || req.headers['x-forwarded-for'] || "";
  await prisma.report.create({data:{reporterId:req.userId,targetId:target.id,reporterIp:ip}});
  // count unique reporter IPs for this target
  const reps = await prisma.report.findMany({where:{targetId:target.id}});
  const uniqueIps = [...new Set(reps.map(r=>r.reporterIp))];
  if(uniqueIps.length >= 3){
    const until = new Date(Date.now()+10*60*60*1000);
    const existingBan = await prisma.ban.findUnique({where:{userId:target.id}});
    if(existingBan){
      await prisma.ban.update({where:{userId:target.id},data:{times:existingBan.times+1,until}});
    }else{
      await prisma.ban.create({data:{userId:target.id,until,times:1}});
    }
    // clear reports for that user
    await prisma.report.deleteMany({where:{targetId:target.id}});
    return res.json({bannedUntil:until.toISOString()});
  }
  res.json({ok:true});
});

// --- Ads (watch to gain status) ---
app.post("/ads/watch", authMiddleware, async (req,res)=>{
  await prisma.user.update({where:{id:req.userId}, data:{ statusPoints: { increment: 1 }}});
  res.json({ok:true});
});

// --- Ranks (buy) ---
app.post("/ranks/buy", authMiddleware, async (req,res)=>{
  const { key, cost } = req.body;
  const user = await prisma.user.findUnique({where:{id:req.userId}});
  if(user.statusPoints < cost) return res.status(400).json({error:"not enough status"});
  await prisma.user.update({where:{id:req.userId}, data:{ statusPoints: { decrement: cost }}});
  res.json({ok:true});
});

// --- Account deletion ---
app.post("/users/delete", authMiddleware, async (req,res)=>{
  const user = await prisma.user.findUnique({where:{id:req.userId}});
  if(!user) return res.status(404).json({error:"not found"});
  // record deleted username to prevent reuse
  await prisma.deletedUsername.create({data:{username:user.username}});
  // remove user data (soft approach: mark deleted)
  await prisma.user.update({where:{id:req.userId}, data:{deleted:true,username:user.username+"__deleted_"+Date.now()}});
  res.json({ok:true});
});

// --- simple health ---
app.get("/", (req,res)=> res.json({ok:true, now:new Date()}));

app.listen(PORT, ()=>{ console.log("Server running on",PORT); });
