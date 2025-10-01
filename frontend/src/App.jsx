import React, {useState, useEffect} from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function App(){
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [me, setMe] = useState(null);
  const [view, setView] = useState("auth");
  useEffect(()=>{ if(token){ localStorage.setItem("token", token); axios.get(API+"/me",{headers:{Authorization:"Bearer "+token}}).then(r=>{setMe(r.data); setView("lobby")}).catch(()=>{setToken(null); setMe(null); setView("auth")}); }},[token]);
  async function signup(u){ const res = await axios.post(API+"/auth/signup", u); setToken(res.data.token); }
  async function login(c){ const res = await axios.post(API+"/auth/login", c); setToken(res.data.token); }
  return (<div className="min-h-screen bg-slate-50 p-6">
    <div className="max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">MBTI Chat</h1>
        {me? <div>Signed in: {me.username} <button className="ml-3" onClick={()=>{setToken(null); setMe(null); localStorage.removeItem("token");}}>Logout</button></div> : null}</header>
      {view==="auth" && <Auth onSignup={signup} onLogin={login} />}
      {view==="lobby" && me && <Lobby me={me} api={API} token={token} />}
    </div>
  </div>);
}

function Auth({onSignup,onLogin}){
  const [u,setU]=useState({username:"",password:"",mbti:"INTJ",secondary:"",email:"",avatar:"Cat"});
  return (<div className="grid grid-cols-2 gap-4">
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold">Signup</h3>
      <input className="w-full border p-2 my-2" placeholder="username" value={u.username} onChange={e=>setU({...u,username:e.target.value})} />
      <input className="w-full border p-2 my-2" placeholder="password" type="password" value={u.password} onChange={e=>setU({...u,password:e.target.value})} />
      <select className="w-full border p-2 my-2" value={u.mbti} onChange={e=>setU({...u,mbti:e.target.value})}>{["INTJ","INTP","ENTP","ENTJ","INFJ","INFP","ENFP","ENFJ","ISTJ","ISFJ","ESTJ","ESFJ","ISTP","ISFP","ESTP","ESFP"].map(m=><option key={m}>{m}</option>)}</select>
      <button className="bg-green-500 text-white px-3 py-2 rounded" onClick={()=>onSignup(u)}>Create account</button>
    </div>
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold">Login</h3>
      <LoginForm onLogin={onLogin} />
    </div>
  </div>);
}
function LoginForm({onLogin}){
  const [c,setC]=useState({username:"",password:""});
  return (<div><input className="w-full border p-2 my-2" placeholder="username" value={c.username} onChange={e=>setC({...c,username:e.target.value})} />
    <input className="w-full border p-2 my-2" placeholder="password" type="password" value={c.password} onChange={e=>setC({...c,password:e.target.value})} />
    <button className="bg-blue-500 text-white px-3 py-2 rounded" onClick={()=>onLogin(c)}>Login</button></div>);
}

function Lobby({me, api, token}){
  const [lobbies, setLobbies]=useState([]);
  useEffect(()=>{ fetchLobbies(); },[]);
  async function fetchLobbies(){ const r = await fetch(api+"/lobbies"); const j=await r.json(); setLobbies(j); }
  return (<div>
    <div className="bg-white p-4 rounded shadow mb-4">
      <div className="flex justify-between"><div><h2 className="font-semibold">Welcome {me.username}</h2><div className="text-sm text-gray-500">MBTI: {me.mbti}</div></div></div>
    </div>
    <div className="grid grid-cols-1 gap-3">{lobbies.map(l=>(<div key={l.id} className="p-3 bg-white rounded shadow flex justify-between items-center"><div><div className="font-semibold">{l.title}</div><div className="text-xs text-gray-500">Owner: {l.ownerUsername}</div></div></div>))}</div>
  </div>);
}
