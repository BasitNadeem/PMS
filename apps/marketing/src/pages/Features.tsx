import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Reveal from "../components/motion/Reveal";
import SplitHeading from "../components/motion/SplitHeading";
import TabbedFeatureBlock from "../components/features/TabbedFeatureBlock";
import { Globe, RefreshCw, Crown, Lock, ShieldCheck, Utensils, Wifi, CheckCircle2, ChevronRight, ShoppingBag, DoorOpen, Plus, Clock } from "lucide-react";

import {
  LiveScheduleMockup, PosTerminalMockup, QrMenuMockup,
  ScanToCountMockup, LiveFolioMockup,
} from "../components/features/TabModuleMockups";



// ─── Report mockup ──────────────────────────────────────────────────────────
function ReportMockup() {
  const rows = [
    { label: "Occupancy",            value: "75%",        delta: "+8%"  },
    { label: "ADR (Avg Daily Rate)", value: "PKR 12,400",  delta: "+12%" },
    { label: "RevPAR",               value: "PKR 9,300",   delta: "+5%"  },
    { label: "Total Revenue",        value: "PKR 3.44M",   delta: "+9%"  },
    { label: "Total Expenses",       value: "PKR 1.12M",   delta: "−3%"  },
    { label: "Net Profit",           value: "PKR 2.32M",   delta: "+18%" },
    { label: "Avg Length of Stay",   value: "2.4 nights",  delta: "+0.3" },
    { label: "Total Guests",         value: "284",         delta: "+22"  },
  ];

  return (
    <div className="rounded-2xl overflow-hidden font-body bg-card border border-line shadow-float">
      <div className="px-5 py-4 border-b border-line-soft">
        <p className="text-[13px] font-semibold text-ink">Monthly Report — June 2026</p>
        <p className="text-[11px] text-ink-soft">vs. May 2026</p>
      </div>
      <div className="divide-y divide-line-soft">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between px-5 py-3">
            <p className="text-[12.5px] text-ink-soft">{r.label}</p>
            <div className="flex items-center gap-3">
              <p className="text-[13px] font-semibold text-ink">{r.value}</p>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: r.delta.startsWith("+") ? "rgba(5,150,105,0.10)" : "rgba(225,29,72,0.10)",
                  color:      r.delta.startsWith("+") ? "#059669" : "#E11D48",
                }}
              >
                {r.delta}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Background Jobs Mockups ───────────────────────────────────────────────
function BriefingMockup() {
  return (
    <div className="h-[320px] w-full bg-[#FAFAF8] border-b border-line-soft flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background glowing orbs */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-[#25D366]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20px] left-[-20px] w-40 h-40 rounded-full bg-[#128C7E]/10 blur-3xl pointer-events-none" />

      {/* iPhone Frame */}
      <div className="w-[220px] h-[450px] bg-white rounded-[36px] border-[8px] border-[#1E1E1E] shadow-[0_24px_60px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden transform rotate-[-2deg] hover:rotate-0 transition-transform duration-500 shrink-0 mt-24">
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-5 flex justify-center z-20">
          <div className="w-20 h-4 bg-[#1E1E1E] rounded-b-xl" />
        </div>

        {/* Header */}
        <div className="pt-8 pb-3 px-4 bg-[#075E54] text-white flex items-center gap-3 relative z-10">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/30 backdrop-blur-sm">
            <span className="text-[12px] font-bold">IF</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[11px] font-bold leading-tight flex items-center gap-1">
              InnFlo Bot
              <span className="w-2.5 h-2.5 bg-[#25D366] rounded-full flex items-center justify-center text-white">
                <CheckCircle2 className="w-1.5 h-1.5" />
              </span>
            </h4>
            <p className="text-[8px] text-white/80 mt-0.5">Automated Briefing</p>
          </div>
        </div>

        {/* Chat Area */}
        <div 
          className="flex-1 p-3 flex flex-col justify-end space-y-3 relative pb-8"
          style={{ backgroundColor: "#E5DDD5" }}
        >
          {/* Chat Background Pattern */}
          <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: "radial-gradient(#000000 0.5px, transparent 0.5px)", backgroundSize: "8px 8px" }} />

          <div className="self-center bg-[#E1F3FB] text-[#4F686A] text-[8px] font-bold px-2.5 py-1 rounded-md shadow-sm z-10 mb-2">
            TODAY
          </div>

          {/* Typing Indicator */}
          <div className="bg-white rounded-2xl rounded-tl-sm p-3 shadow-sm w-fit z-10 flex items-center gap-1 animate-pulse">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          </div>

          {/* Report Bubble */}
          <div className="bg-[#DCF8C6] text-[#1A1A1A] rounded-2xl rounded-tr-sm p-3.5 shadow-sm max-w-[90%] self-end z-10 flex flex-col gap-2 relative">
            <div className="flex items-center gap-1.5 border-b border-black/5 pb-2">
              <span className="text-[12px]">🌙</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#075E54]">Nightly Report</span>
            </div>
            
            <div className="space-y-1.5 text-[10px] font-medium leading-relaxed">
              <div className="flex justify-between items-center">
                <span className="text-black/60">Occupancy</span>
                <span className="font-bold">86% <span className="text-[8px] text-[#25D366]">(+4%)</span></span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-black/60">Revenue</span>
                <span className="font-bold">PKR 78.5K</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-black/60">Tomorrow In</span>
                <span className="font-bold">8 rooms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-black/60">Housekeeping</span>
                <span className="font-bold text-[#075E54]">All clean ✨</span>
              </div>
            </div>

            <div className="flex justify-end items-center gap-1 mt-1 text-[#075E54]">
              <span className="text-[7px] font-medium">11:00 PM</span>
              <svg className="w-3 h-3 text-[#34B7F1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelSyncMockup() {
  return (
    <div className="h-[320px] w-full bg-[#FAFAF8] border-b border-line-soft flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Tech Grid Background */}
      <div className="absolute inset-0 bg-[radial-gradient(#D4D4D8_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
      
      {/* Central Flow Nodes */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Connection Lines */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[120px] border border-blue-500/20 rounded-3xl" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] h-[80px] border border-emerald-500/20 rounded-2xl" />
      </div>

      {/* Main SaaS Dashboard Widget */}
      <div className="w-[280px] rounded-[24px] bg-white border border-line shadow-[0_20px_60px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden z-10 hover:shadow-[0_24px_80px_rgba(0,0,0,0.1)] transition-shadow duration-500">
        <div className="px-5 py-4 bg-white border-b border-line-soft flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin-slow" />
            </div>
            <div>
              <h4 className="text-[12px] font-black text-ink tracking-tight">Channel Manager</h4>
              <p className="text-[10px] text-ink-mute mt-0.5">Real-time bi-directional sync</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold text-emerald-700">Online</span>
          </div>
        </div>

        <div className="p-4 space-y-3 bg-[#FBFBFB]">
          {[
            { name: "Booking.com", color: "bg-[#003580]", text: "text-white", initial: "B.", active: true, time: "Just now" },
            { name: "Airbnb", color: "bg-[#FF5A5F]", text: "text-white", initial: "A.", active: true, time: "2m ago" },
            { name: "Expedia", color: "bg-[#000048]", text: "text-[#FFC000]", initial: "E.", active: true, time: "5m ago" },
          ].map((channel, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-line-soft shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:border-blue-200 transition-colors cursor-default">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-black ${channel.color} ${channel.text} shadow-sm`}>
                  {channel.initial}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-ink">{channel.name}</p>
                  <p className="text-[9px] text-ink-mute mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Rates & Availability
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Synced</span>
                <p className="text-[8px] text-ink-mute mt-1.5">{channel.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HousekeepingPwaMockup() {
  return (
    <div className="h-[320px] w-full bg-[#FAFAF8] border-b border-line-soft flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background accents */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-coral/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />

      {/* Mobile Device Mockup */}
      <div className="w-[230px] h-[480px] bg-white rounded-[40px] border-[10px] border-black shadow-[0_24px_60px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden transform hover:-translate-y-2 transition-transform duration-500 shrink-0 mt-20">
        {/* Notch Area */}
        <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-30">
          <div className="w-24 h-5 bg-black rounded-b-2xl" />
        </div>

        {/* Status Bar */}
        <div className="px-5 pt-1.5 pb-2 bg-ink text-white flex justify-between items-center text-[10px] font-sans font-medium z-20">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <Wifi className="w-3 h-3" />
            <div className="w-4 h-2.5 border border-white/60 rounded-[3px] p-[1px] flex items-center">
              <div className="w-[80%] h-full bg-white rounded-[1.5px]" />
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="px-4 py-4 bg-ink text-white shrink-0 z-20 relative shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] text-white/60 font-bold uppercase tracking-wider mb-1">Housekeeping</p>
              <h3 className="text-[16px] font-black">My Tasks</h3>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
              <span className="text-[12px]">🧹</span>
            </div>
          </div>
          
          {/* Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] font-bold mb-2">
              <span>Progress</span>
              <span className="text-emerald-400">12/15</span>
            </div>
            <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full w-[80%]" />
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 bg-[#F9F9FB] p-3 space-y-3 overflow-y-auto pb-10">
          {[
            { room: "101", type: "Checkout Clean", time: "ASAP", status: "done" },
            { room: "102", type: "Stayover Refresh", time: "Morning", status: "done" },
            { room: "204", type: "Deep Clean", time: "Before 2 PM", status: "active" },
            { room: "205", type: "Touch up", time: "Afternoon", status: "pending" },
          ].map((task, idx) => (
            <div key={idx} className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
              task.status === 'done' ? 'bg-white opacity-60 border-line-soft' : 
              task.status === 'active' ? 'bg-white border-coral/30 shadow-[0_4px_20px_rgba(224,83,43,0.08)]' : 
              'bg-white border-line-soft'
            }`}>
              <div className="flex gap-3 items-center">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[12px] ${
                  task.status === 'done' ? 'bg-emerald-50 text-emerald-600' : 
                  task.status === 'active' ? 'bg-coral text-white' : 
                  'bg-mist text-ink-mute'
                }`}>
                  {task.room}
                </div>
                <div>
                  <p className={`text-[12px] font-bold ${task.status === 'done' ? 'text-ink-soft line-through' : 'text-ink'}`}>{task.type}</p>
                  <p className="text-[9px] text-ink-mute mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {task.time}
                  </p>
                </div>
              </div>
              <div>
                {task.status === 'done' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : task.status === 'active' ? (
                  <button className="bg-coral text-white px-3 py-1.5 rounded-full text-[9px] font-bold shadow-sm">Start</button>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-line-soft" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GuestCrmMockup() {
  return (
    <div className="h-[320px] w-full bg-[#FAFAF8] border-b border-line-soft flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background accents */}
      <div className="absolute top-[-25px] left-[-25px] w-48 h-48 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-25px] right-[-25px] w-48 h-48 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

      {/* CRM Card Widget */}
      <div className="w-[300px] rounded-[24px] bg-white border border-line shadow-[0_20px_60px_rgba(0,0,0,0.08)] flex flex-col hover:-translate-y-1 transition-transform duration-500">
        
        {/* Header Profile Area */}
        <div className="p-5 flex items-center gap-4 border-b border-line-soft relative overflow-hidden">
          {/* Pattern overlay */}
          <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-blue-50 to-transparent" />
          
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[20px] font-black shadow-lg relative z-10">
            AL
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
              <span className="w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
              </span>
            </div>
          </div>
          
          <div className="relative z-10">
            <h3 className="text-[16px] font-black text-ink tracking-tight">Alison Larsen</h3>
            <p className="text-[11px] text-ink-mute font-medium mt-1">alison.larsen@example.com</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/50 px-2 py-0.5 rounded-full">VIP Guest</span>
              <span className="text-[9px] font-bold text-ink-mute bg-mist px-2 py-0.5 rounded-full">4 Stays</span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F8F9FA] rounded-xl p-3 border border-line-soft">
              <p className="text-[9px] font-bold text-ink-mute uppercase tracking-wider">Lifetime Spend</p>
              <p className="text-[16px] font-black text-ink mt-1">$3,667.22</p>
            </div>
            <div className="bg-[#F8F9FA] rounded-xl p-3 border border-line-soft">
              <p className="text-[9px] font-bold text-ink-mute uppercase tracking-wider">Last Stay</p>
              <p className="text-[14px] font-bold text-ink mt-1">Mar 2026</p>
              <p className="text-[9px] text-emerald-600 font-bold mt-0.5">Room 402</p>
            </div>
          </div>

          {/* Preferences */}
          <div>
            <p className="text-[9px] font-bold text-ink-mute uppercase tracking-wider mb-2">Saved Preferences</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { icon: "☕️", text: "Extra Coffee Pods" },
                { icon: "🤫", text: "Quiet Floor" },
                { icon: "🛏", text: "King Bed Required" },
                { icon: "🚗", text: "Parking Space" }
              ].map((pref, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white border border-line px-2.5 py-1.5 rounded-lg shadow-sm">
                  <span className="text-[10px]">{pref.icon}</span>
                  <span className="text-[10px] font-bold text-ink">{pref.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── QR & Kitchen Dual Mockup ────────────────────────────────────────────────
function QrKitchenDualMockup() {
  return (
    <div className="relative flex flex-col md:flex-row items-center md:items-end gap-6 justify-center select-none w-full max-w-4xl mx-auto">

      {/* ── PHONE — QR menu app ── */}
      <div
        className="relative z-10 rounded-[36px] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.18)] flex-shrink-0 border-black"
        style={{ width: 220, background: "#0F0F0F", borderWidth: "6px" }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 bg-black">
          <span className="text-[9px] font-bold text-white/70">9:41</span>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-2.5 h-2.5 text-white/70" />
            <div className="flex gap-0.5 items-end h-2.5">
              {[2,3,4,4].map((h,i) => <span key={i} className="w-0.5 rounded-sm bg-white/70" style={{ height: h * 2.5 }} />)}
            </div>
          </div>
        </div>

        {/* App header */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#18181B" }}>
          <div>
            <p className="text-white text-[11.5px] font-black tracking-tight leading-none">InnFlo Menu</p>
            <p className="text-white/50 text-[8.5px] mt-1">Room 201 · Sea View Suite</p>
          </div>
          <div className="w-6 h-6 rounded-full bg-coral/20 flex items-center justify-center">
            <Utensils className="w-2.5 h-2.5 text-coral" />
          </div>
        </div>

        {/* QR scan animation strip */}
        <div className="relative overflow-hidden mx-4 my-3 rounded-2xl" style={{ background: "#27272A", height: 110 }}>
          {/* QR grid */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-16 h-16 opacity-70">
              {/* Corner markers */}
              {[["top-0 left-0","border-t-2 border-l-2"],["top-0 right-0","border-t-2 border-r-2"],["bottom-0 left-0","border-b-2 border-l-2"],["bottom-0 right-0","border-b-2 border-r-2"]].map(([pos, bdr]) => (
                <span key={pos} className={`absolute w-3.5 h-3.5 ${pos} ${bdr} border-coral rounded-sm`} />
              ))}
              {/* QR dot grid */}
              <div className="absolute inset-2 grid grid-cols-7 gap-0.5 opacity-60">
                {Array.from({ length: 49 }, (_, i) => (
                  <span key={i} className="rounded-[1px]" style={{ background: Math.random() > 0.4 ? "#fff" : "transparent", aspectRatio: "1" }} />
                ))}
              </div>
            </div>
          </div>
          {/* Scan line */}
          <div
            className="absolute left-3 right-3 h-0.5 rounded-full"
            style={{ background: "linear-gradient(90deg, transparent, #E0532B, transparent)", top: "40%", boxShadow: "0 0 10px 2px rgba(224,83,43,0.4)", animation: "scanline 2.2s ease-in-out infinite" }}
          />
          {/* Label */}
          <p className="absolute bottom-2 left-0 right-0 text-center text-[8px] text-white/40 font-medium">
            Scan to Order
          </p>
        </div>

        {/* Delivery type selector */}
        <div className="px-4 pb-2">
          <p className="text-white/40 text-[7.5px] uppercase tracking-wider font-bold mb-1.5">Delivery</p>
          <div className="flex gap-1">
            {[
              { label: "Room", icon: <DoorOpen className="w-2.5 h-2.5" />, active: true },
              { label: "Dine In", icon: <Utensils className="w-2.5 h-2.5" />, active: false },
              { label: "Pick-up", icon: <ShoppingBag className="w-2.5 h-2.5" />, active: false },
            ].map(o => (
              <button
                key={o.label}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[7.5px] font-bold transition-colors ${
                  o.active ? "bg-coral text-white" : "bg-white/10 text-white/50"
                }`}
              >
                {o.icon}
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Menu items */}
        <div className="px-4 pb-2 space-y-1.5">
          <p className="text-white/40 text-[7.5px] uppercase tracking-wider font-bold mb-1">Popular Items</p>
          {[
            { name: "Club Sandwich", price: "PKR 950", added: true },
            { name: "Grilled Chicken", price: "PKR 1,200", added: false },
          ].map(item => (
            <div key={item.name} className="flex items-center justify-between px-2 py-1.5 rounded-xl" style={{ background: "#18181B" }}>
              <div>
                <p className="text-white text-[8.5px] font-semibold leading-none">{item.name}</p>
                <p className="text-white/40 text-[7px] mt-0.5">{item.price}</p>
              </div>
              <div
                className={`w-4.5 h-4.5 rounded-lg flex items-center justify-center ${item.added ? "bg-coral" : "bg-white/10"}`}
              >
                {item.added
                  ? <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                  : <ChevronRight className="w-2.5 h-2.5 text-white/40" />
                }
              </div>
            </div>
          ))}
        </div>

        {/* Pay selector */}
        <div className="px-4 pb-3 pt-1">
          <div className="flex gap-1 mb-2">
            {[
              { label: "Room Folio", active: true },
              { label: "Pay Spot", active: false },
            ].map(o => (
              <button
                key={o.label}
                className={`flex-1 py-1 rounded-lg text-[7.5px] font-bold ${
                  o.active ? "bg-emerald-500 text-white" : "bg-white/10 text-white/50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="w-full py-2 rounded-xl bg-coral flex items-center justify-center gap-1">
            <span className="text-white text-[9.5px] font-black">Place Order</span>
            <ChevronRight className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
      </div>

      {/* ── ARROW between phone and KDS ── */}
      <div className="hidden md:flex flex-col items-center gap-1 mb-20 z-20 shrink-0">
        <div className="flex flex-col items-center">
          {[0,1,2].map(i => (
            <ChevronRight key={i} className="w-4 h-4 text-coral/60" style={{ marginTop: i === 0 ? 0 : -6 }} />
          ))}
        </div>
        <span className="text-[8px] font-bold text-coral/60 text-center leading-tight whitespace-nowrap mt-0.5">
          in seconds
        </span>
      </div>

      {/* ── KDS — Wide Computer Monitor Screen ── */}
      <div className="relative flex-1 min-w-[280px] md:min-w-[460px] flex flex-col items-center group">
        {/* Computer Monitor Body */}
        <div
          className="w-full rounded-2xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.12)] flex flex-col border bg-[#111315]"
          style={{ height: 290, borderColor: "#27272A" }}
        >
          {/* Browser Chrome Header */}
          <div className="px-4 py-2.5 bg-[#181A1C] border-b flex items-center justify-between" style={{ borderColor: "#222528" }}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="w-2 h-2 rounded-full bg-white/20" />
              <span className="ml-3 text-[10px] font-bold text-white/70 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Kitchen Display Screen (KDS)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8.5px] font-bold text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded">Station: Main Hot Kitchen</span>
              <span className="text-[9px] text-white/50 font-medium">09:41 AM</span>
            </div>
          </div>

          {/* Monitor Display Grid (3 ticket columns) */}
          <div className="flex-1 p-3 grid grid-cols-3 gap-3 overflow-hidden bg-[#0D0E10]">
            
            {/* Column 1: NEW TICKET (Highlighted Room 201 Order) */}
            <div className="rounded-xl overflow-hidden border flex flex-col bg-[#161D26] border-coral/40 shadow-[0_4px_16px_rgba(224,83,43,0.15)]">
              {/* Header */}
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-coral/10 border-b border-coral/20">
                <span className="text-[8.5px] font-black text-coral uppercase tracking-widest">New</span>
                <span className="text-[9px] font-bold text-white">#082</span>
              </div>
              <div className="px-2.5 py-2 flex-1 space-y-1">
                <div className="flex justify-between items-center text-[7.5px] text-white/40 font-bold mb-1.5">
                  <span>ROOM 201</span>
                  <span>ROOM SERVICE</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-[9px] font-black text-coral w-3 shrink-0">1×</span>
                  <span className="text-[9px] font-bold text-white leading-tight">Club Sandwich</span>
                </div>
                <p className="text-[7.5px] pl-4 italic text-white/35 font-medium">No onions, extra mayo</p>
              </div>
              {/* Footer */}
              <div className="px-2.5 py-1.5 bg-[#1C232E] border-t border-coral/10 flex items-center justify-between text-[8px]">
                <span className="font-semibold text-coral">Preparing</span>
                <span className="text-white/40 font-mono">0:42</span>
              </div>
            </div>

            {/* Column 2: IN-PROGRESS TICKET */}
            <div className="rounded-xl overflow-hidden border border-line-soft/10 flex flex-col bg-[#131517] text-white/60">
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#181A1C] border-b border-line-soft/15">
                <span className="text-[8px] font-bold text-white/40">PREP</span>
                <span className="text-[9px] font-bold text-white/80">#080</span>
              </div>
              <div className="px-2.5 py-2 flex-1 space-y-1.5">
                <div className="flex justify-between items-center text-[7.5px] text-white/40 font-bold">
                  <span>TABLE 4</span>
                  <span>DINE IN</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-start gap-1">
                    <span className="text-[9px] font-black text-white/60 w-3 shrink-0">2×</span>
                    <span className="text-[9.5px] font-bold text-white/80 leading-tight">Grilled Chicken</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="text-[9px] font-black text-white/60 w-3 shrink-0">2×</span>
                    <span className="text-[9.5px] font-bold text-white/80 leading-tight">French Fries</span>
                  </div>
                </div>
              </div>
              <div className="px-2.5 py-1.5 bg-[#181A1C] border-t border-line-soft/10 flex items-center justify-between text-[8px]">
                <span className="font-semibold text-amber-400">Preparing</span>
                <span className="text-white/30 font-mono">4:10</span>
              </div>
            </div>

            {/* Column 3: READY / COMPLETED TICKET */}
            <div className="rounded-xl overflow-hidden border border-line-soft/10 flex flex-col bg-[#131517] opacity-60">
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#181A1C] border-b border-line-soft/15">
                <span className="text-[8px] font-bold text-white/40">READY</span>
                <span className="text-[9px] font-bold text-white/80">#079</span>
              </div>
              <div className="px-2.5 py-2 flex-1 space-y-1.5">
                <div className="flex justify-between items-center text-[7.5px] text-white/40 font-bold">
                  <span>TABLE 2</span>
                  <span>DINE IN</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-start gap-1">
                    <span className="text-[9px] font-black text-white/60 w-3 shrink-0">1×</span>
                    <span className="text-[9.5px] font-bold text-white/80 leading-tight">Mango Smoothie</span>
                  </div>
                </div>
              </div>
              <div className="px-2.5 py-1.5 bg-[#181A1C] border-t border-line-soft/10 flex items-center justify-between text-[8px]">
                <span className="font-semibold text-emerald-400">Ready</span>
                <span className="text-white/30 font-mono">7:28</span>
              </div>
            </div>

          </div>

          {/* Browser footer */}
          <div className="px-4 py-2 bg-[#181A1C] border-t flex items-center justify-between text-[8.5px] text-white/30" style={{ borderColor: "#222528" }}>
            <span className="flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5" /> Auto-syncing live</span>
            <span className="font-bold text-white/40">3 Active Tickets</span>
          </div>
        </div>

        {/* Monitor Neck & Base */}
        <div className="w-14 h-4 bg-[#1F2224] border-x border-[#1C1F21]" />
        <div className="w-36 h-2 rounded-t-lg bg-[#2D3135] shadow-[0_4px_12px_rgba(0,0,0,0.15)]" />

        {/* Folio update toast — floats above base */}
        <div
          className="absolute z-30 flex items-start gap-2.5 px-3 py-2 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] bg-white border border-emerald-200/80"
          style={{ bottom: 20, right: 30, maxWidth: 210 }}
        >
          <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          </div>
          <div>
            <p className="text-[9.5px] font-black text-emerald-800 leading-none">Live Folio Sync</p>
            <p className="text-[8px] mt-1 text-emerald-600 font-semibold">
              Room 201: Club Sandwich (+PKR 950)
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── One Calendar Mockup ─────────────────────────────────────────────────────
function OneCalendarMockup() {
  // July 2026 calendar — Mon 7 to Sun 20 (2 weeks)
  const days = ["Mon 7","Tue 8","Wed 9","Thu 10","Fri 11","Sat 12","Sun 13","Mon 14","Tue 15","Wed 16","Thu 17","Fri 18","Sat 19","Sun 20"];
  const COL = 52; // px per day column
  const ROW_H = 44; // px per room row
  const ROOM_W = 130; // px for room label column

  // bookings: { room, label, source, start (0-indexed), span, color, vip, blocked }
  const bookings = [
    { room: 0, label: "Ahmed R.",    source: "Walk-in",      start: 0, span: 4, color: "#059669", vip: false },
    { room: 0, label: "Hamza A.",    source: "Booking.com",  start: 5, span: 4, color: "#2563EB", vip: false },
    { room: 0, label: "Nadia S. 👑",  source: "Direct",       start: 10, span: 4, color: "#9333EA", vip: true  },

    { room: 1, label: "Bilal M.",    source: "Agoda",        start: 1, span: 5, color: "#059669", vip: false },
    { room: 1, label: "Rao F.",      source: "Airbnb",       start: 7, span: 5, color: "#D97706", vip: false },
    { room: 1, label: "Enquiry",     source: "WhatsApp",     start: 13, span: 1, color: "#94A3B8", vip: false },

    { room: 2, label: "Group — 12 rooms", source: "Expedia", start: 0, span: 7, color: "#2563EB", vip: false },
    { room: 2, label: "Zara K. 👑",  source: "Direct",       start: 8, span: 5, color: "#9333EA", vip: true  },

    { room: 3, label: "Ali M.",      source: "Bookme.pk",    start: 2, span: 3, color: "#059669", vip: false },
    { room: 3, label: "Pending",     source: "Phone",        start: 6, span: 3, color: "#94A3B8", vip: false },
    { room: 3, label: "Sarah T. 👑",  source: "Direct",       start: 10, span: 4, color: "#9333EA", vip: true  },
  ];

  const rooms = [
    { label: "101 · Deluxe Double", clean: true },
    { label: "102 · Deluxe Double", clean: true },
    { label: "103–114 · Suite Block", clean: false },
    { label: "201 · Sea View Suite", clean: true },
  ];

  // "Now" is between day index 4 and 5 (Fri 11)
  const nowX = ROOM_W + COL * 4 + COL * 0.5;

  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-line shadow-[0_8px_40px_rgba(0,0,0,0.07)] font-body select-none">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-mist border-b border-line-soft">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-60" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-60" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-60" />
        <div className="ml-3 flex-1 flex items-center justify-between">
          <div className="bg-white border border-line-soft/80 px-3 py-0.5 rounded text-[11px] text-ink-mute flex items-center gap-1.5 max-w-[200px] truncate">
            <Globe className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">innflo.com/reservations</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/50 font-bold px-2 py-0.5 rounded-full">Live</span>
            <span className="text-[10px] text-ink-mute font-medium">Jul 2026</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line-soft bg-paper">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-black text-ink tracking-tight">July 2026</span>
          <span className="text-[9.5px] font-bold text-ink-mute bg-mist px-2 py-0.5 rounded-full">← Week →</span>
        </div>
        <div className="flex items-center gap-3 text-[9.5px] font-bold text-ink-mute">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#059669]" />Checked In</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#2563EB]" />Confirmed</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#D97706]" />Enquiry</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-[#9333EA]" />VIP 👑</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: ROOM_W + COL * days.length + 2 }}>
          {/* Header row — days */}
          <div className="flex bg-mist border-b border-line-soft sticky top-0 z-10">
            <div style={{ width: ROOM_W, minWidth: ROOM_W }} className="px-3 py-2 text-[9px] font-bold text-ink-mute uppercase tracking-wider shrink-0">
              Room · Type
            </div>
            {days.map((d, i) => (
              <div
                key={d}
                style={{ width: COL, minWidth: COL }}
                className={`text-center text-[9px] py-2 font-bold shrink-0 border-l border-line-soft/40 ${
                  i === 4 ? "text-coral-dark bg-coral-soft/50" : "text-ink-mute"
                }`}
              >
                {d.split(" ")[0]}<br />{d.split(" ")[1]}
              </div>
            ))}
          </div>

          {/* Room rows */}
          {rooms.map((room, rowIdx) => (
            <div key={room.label} className="flex border-b border-line-soft/50 last:border-b-0 relative" style={{ height: ROW_H }}>
              {/* Room label */}
              <div
                style={{ width: ROOM_W, minWidth: ROOM_W, height: ROW_H }}
                className="flex items-center px-3 gap-2 border-r border-line-soft/60 bg-paper shrink-0"
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${room.clean ? "bg-emerald-500" : "bg-amber-400"}`} />
                <span className="text-[10px] font-bold text-ink truncate leading-tight">{room.label}</span>
              </div>

              {/* Day cells */}
              <div className="flex flex-1 relative" style={{ height: ROW_H }}>
                {days.map((_, colIdx) => (
                  <div
                    key={colIdx}
                    style={{ width: COL, minWidth: COL, height: ROW_H }}
                    className={`border-l border-line-soft/30 shrink-0 ${colIdx === 4 ? "bg-coral-soft/10" : colIdx >= 6 && colIdx <= 6 ? "bg-mist/40" : ""}`}
                  />
                ))}

                {/* Booking bars for this row */}
                {bookings
                  .filter(b => b.room === rowIdx)
                  .map((b, bIdx) => (
                    <div
                      key={bIdx}
                      className="absolute flex items-center group"
                      style={{
                        left: b.start * COL + 3,
                        top: 6,
                        height: ROW_H - 12,
                        width: b.span * COL - 6,
                      }}
                    >
                      <div
                        className="w-full h-full rounded-lg flex items-center px-2 gap-1.5 overflow-hidden relative"
                        style={{ background: b.color, opacity: b.source === "WhatsApp" ? 0.65 : 0.9 }}
                      >
                        {b.vip && (
                          <Crown className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                        )}
                        <span className="text-white text-[9.5px] font-bold truncate leading-none">{b.label}</span>
                        {b.span >= 3 && (
                          <span
                            className="ml-auto text-[7.5px] text-white/70 font-medium truncate shrink-0 hidden group-hover:block"
                          >
                            {b.source}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          ))}

          {/* NOW indicator line */}
          <div
            className="absolute top-[54px] bottom-0 pointer-events-none"
            style={{ left: nowX, width: 2, background: "#E0532B", zIndex: 20 }}
          >
            <div className="absolute top-[-6px] left-[-5px] w-3 h-3 rounded-full bg-coral shadow-[0_0_6px_rgba(224,83,43,0.6)]" />
          </div>
        </div>
      </div>

      {/* Footer — source legend */}
      <div className="px-4 py-2.5 border-t border-line-soft bg-mist flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap text-[9px] font-medium text-ink-mute">
          {["Walk-in","Phone","WhatsApp","Direct","Booking.com","Agoda","Airbnb","Expedia","Bookme.pk"].map(s => (
            <span key={s} className="bg-white border border-line-soft px-1.5 py-0.5 rounded font-semibold">{s}</span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-coral-dark font-bold">
          <Lock className="w-2.5 h-2.5" />
          <span>No double-booking</span>
        </div>
      </div>
    </div>
  );
}

// ─── Channel Manager — channels → InnFlo → calendar flow diagram ───────────
function ChannelManagerFlowMockup() {
  const channels = [
    { name: "Booking.com", color: "#003580", text: "B.", accent: "bg-blue-500", rooms: "3 Rooms" },
    { name: "Airbnb",      color: "#FF5A5F", text: "A.", accent: "bg-rose-500", rooms: "2 Rooms" },
    { name: "Expedia",     color: "#FFC000", text: "E.", accent: "bg-amber-500", textDark: true, rooms: "3 Rooms" },
    { name: "Agoda",       color: "#5B1E96", text: "Ag", accent: "bg-purple-500", rooms: "4 Rooms" },
  ];

  const days = ["Mon 7", "Tue 8", "Wed 9", "Thu 10", "Fri 11", "Sat 12", "Sun 13"];
  const calendarRows = [
    { room: "101 Deluxe", source: "Booking.com", span: 3, start: 0, color: "bg-blue-600" },
    { room: "102 Double", source: "Airbnb", span: 2, start: 4, color: "bg-rose-500" },
    { room: "103 Suite", source: "Expedia", span: 4, start: 1, color: "bg-amber-500" },
  ];

  return (
    <div className="rounded-2xl overflow-hidden font-body bg-white border border-line shadow-[0_8px_40px_rgba(0,0,0,0.07)] select-none">
      {/* Browser chrome header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-mist border-b border-line-soft">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-60" />
          <div className="ml-3 bg-white border border-line-soft/80 px-2 py-0.5 rounded text-[11px] text-ink-mute flex items-center gap-1">
            <Globe className="w-2.5 h-2.5 shrink-0" />
            <span>innflo.com/channel-manager</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-coral-dark bg-coral-soft/50 font-bold px-2 py-0.5 rounded-full">Sync Active</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Main Flow Layout */}
      <div className="p-5 bg-paper grid grid-cols-1 md:grid-cols-[1.3fr_0.4fr_2fr] gap-4 items-center relative min-h-[300px]">

        {/* ── LEFT: Channel Sources List ── */}
        <div className="space-y-2.5">
          <p className="text-[8.5px] font-black text-ink-mute uppercase tracking-wider mb-2">Attached OTAs</p>
          {channels.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-white border border-line-soft shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-line transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                {/* Simulated Channel Logo Brand Badge */}
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[9.5px] font-black shrink-0 shadow-inner"
                  style={{ background: c.color, color: c.textDark ? "#1C1917" : "#FFFFFF" }}
                >
                  {c.text}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-ink leading-none">{c.name}</p>
                  <p className="text-[7.5px] mt-0.5 text-ink-mute font-medium">{c.rooms} active</p>
                </div>
              </div>
              {/* Sync status */}
              <div className="flex items-center gap-1.5">
                <span className="text-[7.5px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">Synced</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
            </div>
          ))}
        </div>

        {/* ── CENTER: InnFlo Sync Hub Icon & Flows ── */}
        <div className="flex flex-col items-center justify-center py-4 md:py-0">
          <div className="relative flex items-center justify-center">
            {/* Pulsing Sync Ring */}
            <div className="absolute w-14 h-14 rounded-full border border-coral/30 animate-ping opacity-40" />
            <div className="absolute w-11 h-11 rounded-full border-2 border-dashed border-coral/20 animate-spin" style={{ animationDuration: "12s" }} />
            
            {/* Core Hub Badge */}
            <div className="relative z-10 w-9 h-9 rounded-xl bg-ink text-paper flex items-center justify-center shadow-lg border border-line-soft/30">
              <RefreshCw className="w-4 h-4 text-coral animate-spin" style={{ animationDuration: "6s" }} />
            </div>
          </div>
          <span className="text-[8px] font-black text-ink-mute uppercase tracking-widest mt-2 whitespace-nowrap text-center">
            InnFlo Sync
          </span>
          <span className="text-[6.5px] text-coral font-bold uppercase tracking-widest mt-0.5">
            Realtime
          </span>
        </div>

        {/* ── RIGHT: Master Reservation Calendar Mockup ── */}
        <div className="rounded-xl border border-line-soft bg-white shadow-[0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* Calendar top toolbar */}
          <div className="px-3 py-2 bg-mist border-b border-line-soft flex items-center justify-between text-[8px] font-bold text-ink-mute">
            <span>InnFlo Master Calendar</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-600" />Booking.com</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Airbnb</span>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[280px]">
              {/* Day headers */}
              <div className="flex border-b border-line-soft bg-mist/60 text-[7.5px] font-bold text-ink-mute text-center">
                <div className="w-16 py-1 border-r border-line-soft/50 text-left px-2">Room</div>
                {days.map((d) => (
                  <div key={d} className="flex-1 py-1 border-r border-line-soft/30 last:border-r-0">{d.split(" ")[1]}</div>
                ))}
              </div>

              {/* Room rows with syncing bars */}
              {calendarRows.map((r, rowIdx) => (
                <div key={rowIdx} className="flex border-b border-line-soft/50 last:border-b-0 relative h-9 items-center">
                  {/* Room Label */}
                  <div className="w-16 px-2 text-[8px] font-bold text-ink border-r border-line-soft/50 h-full flex items-center bg-white shrink-0 z-10">
                    {r.room}
                  </div>

                  {/* Day background cells */}
                  <div className="flex flex-1 h-full relative items-center">
                    {Array.from({ length: 7 }).map((_, cellIdx) => (
                      <div key={cellIdx} className="flex-1 border-r border-line-soft/20 last:border-r-0 h-full" />
                    ))}

                    {/* Channel reservation bar */}
                    <div
                      className="absolute h-5 rounded-md flex items-center px-1.5 gap-1 overflow-hidden"
                      style={{
                        left: `${(r.start / 7) * 100}%`,
                        width: `${(r.span / 7) * 100}%`,
                        marginLeft: "2px",
                        marginRight: "2px"
                      }}
                    >
                      <div className={`w-full h-full rounded ${r.color} flex items-center px-1.5 gap-1 text-[7.5px] font-bold text-white shadow-sm`}>
                        <span className="truncate">{r.source} Stay</span>
                        <span className="ml-auto w-1 h-1 rounded-full bg-white/70 animate-ping" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar status bar */}
          <div className="px-3 py-1.5 bg-mist border-t border-line-soft flex items-center justify-between text-[7px] text-ink-mute font-medium">
            <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5 text-coral" /> Closed on other channels</span>
            <span className="font-bold text-emerald-600 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-500" /> Live rates sync</span>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── FAQ ────────────────────────────────────────────────────────────────────
const FEATURE_FAQS = [
  {
    q: "Does the POS and QR Dining charge straight to the guest's room?",
    a: "Yes. Every order — whether rung up at the register or placed by a guest scanning a QR code — posts directly to that guest's live folio. Nothing gets tracked on a separate notepad and reconciled later.",
  },
  {
    q: "How does the Inventory 'point your phone' feature actually work?",
    a: "Photograph a shelf and InnFlo reads what's on it — no manual SKU entry, no clipboard count. Set a par level once, and low-stock items surface automatically the next time you scan.",
  },
  {
    q: "What happens to Housekeeping if the Wi-Fi drops mid-shift?",
    a: "Nothing stops. Staff keep marking rooms clean from their phone with no connection at all, and every update syncs to the front desk the moment a signal comes back.",
  },
  {
    q: "Can I see a live demo before deciding anything?",
    a: "Yes — reach out and we'll walk you through the actual product on a call, not a slide deck. You'll see real screens, ask real questions, and decide from there.",
  },
  {
    q: "Is there a free trial?",
    a: "Not a fixed self-serve trial today — instead you get a live demo and an honest conversation about whether InnFlo fits your property, with no pressure either way.",
  },
  {
    q: "How long does it take to get set up?",
    a: "Most properties are up and running within a few days — rooms, rates, and staff accounts loaded in, with onboarding support included rather than a self-service manual to figure out alone.",
  },
  {
    q: "When is Channel Manager launching?",
    a: "It's actively in development, with no fixed date yet. Get in touch and we'll notify you the moment direct OTA sync goes live.",
  },
];

function FeatureFaqRow({ q, a, isOpen, onClick }: { q: string; a: string; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-line">
      <button
        onClick={onClick}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-6 py-4 text-left"
      >
        <span className="text-[18px] sm:text-[19px] font-bold font-body text-ink">{q}</span>
        <span
          className={`shrink-0 h-5 w-5 rounded-md bg-coral shadow-pop grid place-items-center transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
        >
          <Plus className="h-2.5 w-2.5 text-white" strokeWidth={3} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="text-[15.5px] text-ink-soft font-body leading-relaxed text-justify pb-5 pr-14">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Features() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-paper text-ink">

      {/* ── OPENER ─────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-24 px-6 bg-grid relative overflow-hidden">
        <div
          className="absolute pointer-events-none"
          style={{ top: "-15%", right: "-10%", width: "55%", height: "70%", background: "radial-gradient(ellipse, rgba(224,83,43,0.09), transparent 65%)" }}
        />
        <div className="relative mx-auto max-w-7xl">
          <Reveal variant="fade"><p className="eyebrow mb-6">What's inside</p></Reveal>
          <h1 className="font-display text-[clamp(46px,7.5vw,92px)] font-medium leading-[0.98] text-ink">
            <SplitHeading as="span" className="block">Everything</SplitHeading>
            <SplitHeading as="span" delay={0.25} className="block italic text-ink-soft">your property</SplitHeading>
            <SplitHeading as="span" delay={0.5} className="block text-coral-dark">needs.</SplitHeading>
          </h1>
        </div>
      </section>

      {/* ── OPERATIONS — one block, five features, five tabs ────────────────── */}
      <TabbedFeatureBlock
        eyebrow="Operations"
        headline="Your property, one screen at a time."
        mockupSide="left"
        mockupMinHeight="460px"
        tabs={[
          {
            label: "Dashboard",
            heading: "Walk in. Glance up. Know everything.",
            copy: "Arrivals, departures, revenue, and shift notes — the whole day on one screen, updating live, with a marker showing exactly where you are right now.",
            mockup: <LiveScheduleMockup />,
          },
          {
            label: "POS",
            heading: "Ring it up. Room it up.",
            copy: "Ring up a coffee, a spa treatment, a late checkout fee — charged straight to the room, no separate register to reconcile.",
            mockup: <PosTerminalMockup />,
          },
          {
            label: "QR Dining & Kitchen",
            heading: "Guests order. Kitchen knows. Nothing's missed.",
            copy: "A QR code on the table — guests browse and order with no app, no call to the front desk — and every ticket lands on the kitchen screen the instant it's placed.",
            mockup: <QrMenuMockup />,
          },
          {
            label: "Inventory",
            heading: "Point your phone. Count your shelf.",
            copy: "Set a par level once, and let the camera do the counting. Photograph the shelf and InnFlo reads the labels for you — no clipboard, no typing every SKU by hand.",
            mockup: <ScanToCountMockup />,
          },
          {
            label: "Financials",
            heading: "The books that balance themselves.",
            copy: "Room, F&B, laundry, tax, discount — every charge lands on one live folio. Every payment and expense, auto-logged and reconciled.",
            mockup: <LiveFolioMockup />,
          },
        ]}
      />

      {/* ── THE SMALL JOBS — BACKGROUND TASKS ─────────────────────────────── */}
      <section className="py-24 bg-mist border-y border-line overflow-hidden">
        <div className="mx-auto max-w-[92rem] px-6">
          <Reveal variant="fade" className="text-center mb-16">
            <p className="eyebrow text-[#0A5C53] mb-4">Day to day</p>
            <h2 className="font-body text-[clamp(28px,3.8vw,42px)] font-bold text-ink leading-tight">
              The small jobs, handled<br />in the background
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* WhatsApp Nightly Briefing */}
            <Reveal variant="rise" delay={0.0}>
              <div className="rounded-3xl bg-card border border-line overflow-hidden shadow-card hover:shadow-float transition-all duration-300 h-full flex flex-col">
                <BriefingMockup />
                <div className="p-8 flex-1 flex flex-col">
                  <h3 className="font-body text-[18px] font-bold text-ink mb-3">
                    Nightly WhatsApp Briefing
                  </h3>
                  <p className="text-[15.5px] text-ink-soft leading-relaxed font-body">
                    No need to log in to see how your day went. Every night at 11 PM, InnFlo auto-sends the owner a complete operational summary: occupancy, daily revenue, tomorrow's arrivals, housekeeping backlog, and open maintenance tickets.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Auto Channel Sync */}
            <Reveal variant="rise" delay={0.06}>
              <div className="rounded-3xl bg-card border border-line overflow-hidden shadow-card hover:shadow-float transition-all duration-300 h-full flex flex-col">
                <ChannelSyncMockup />
                <div className="p-8 flex-1 flex flex-col">
                  <h3 className="font-body text-[18px] font-bold text-ink mb-3">
                    Auto Channel Sync
                  </h3>
                  <p className="text-[15.5px] text-ink-soft leading-relaxed font-body">
                    Rates, dates, and availability synchronize across Booking.com, Agoda, Expedia, and Airbnb in the background. The instant a guest checks in or books a room, other channels update to prevent double-bookings.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Guest CRM */}
            <Reveal variant="rise" delay={0.12}>
              <div className="rounded-3xl bg-card border border-line overflow-hidden shadow-card hover:shadow-float transition-all duration-300 h-full flex flex-col">
                <GuestCrmMockup />
                <div className="p-8 flex-1 flex flex-col">
                  <h3 className="font-body text-[18px] font-bold text-ink mb-3">
                    Guest CRM
                  </h3>
                  <p className="text-[15.5px] text-ink-soft leading-relaxed font-body">
                    Every guest builds a history — past stays, lifetime spend, and the preferences they mentioned once. Filter by who hasn't stayed in a while and reach out with a seasonal offer, right when it'll actually land.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Housekeeping, automated */}
            <Reveal variant="rise" delay={0.18}>
              <div className="rounded-3xl bg-card border border-line overflow-hidden shadow-card hover:shadow-float transition-all duration-300 h-full flex flex-col">
                <HousekeepingPwaMockup />
                <div className="p-8 flex-1 flex flex-col">
                  <h3 className="font-body text-[18px] font-bold text-ink mb-3">
                    Housekeeping, automated
                  </h3>
                  <p className="text-[15.5px] text-ink-soft leading-relaxed font-body">
                    A checkout closes and the cleaning task appears on its own — no one has to notice, remember, or write it down. Staff mark rooms done from their phone, and the front desk sees it the same second.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── RESERVATIONS ───────────────────────────────────────────────────── */}
      <section className="py-28 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[36%_64%] gap-16 items-center">
            {/* Left — Copy */}
            <Reveal>
              <p className="eyebrow mb-5">Reservations</p>
              <h2 className="font-display text-[clamp(34px,4.5vw,52px)] font-medium leading-tight text-ink mb-6">
                One calendar.<br />All bookings.
              </h2>
              <p className="text-[17px] text-ink-soft font-body leading-relaxed mb-8">
                Walk-ins, calls, WhatsApp, your own website, Booking.com, Agoda, Expedia, Airbnb — every source feeds the same calendar. If a room is taken, it's taken everywhere.
              </p>
              <ul className="space-y-4 font-body text-[15.5px] text-ink-soft">
                {[
                  { icon: <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />, text: "VIP guest tagging with crown badge, advance payments & special requests" },
                  { icon: <Lock className="w-4 h-4 text-coral shrink-0 mt-0.5" />, text: "Hard double-booking prevention — a room cannot be booked twice, ever" },
                  { icon: <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />, text: "Group bookings with split or single-folio billing across rooms" },
                  { icon: <span className="text-ink-soft font-bold text-[16px] leading-none shrink-0 mt-0.5">—</span>, text: "Waitlist, No-Show, and Cancellation tracking with reasons" },
                  { icon: <span className="text-ink-soft font-bold text-[16px] leading-none shrink-0 mt-0.5">—</span>, text: "Estimated arrival time and transport mode per guest" },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    {item.icon}
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* Right — Calendar Mockup */}
            <Reveal delay={0.1} variant="rise">
              <OneCalendarMockup />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── WHATSAPP BRIEFING ──────────────────────────────────────────────── */}
      <section className="bg-ink py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <span className="rule-coral block w-12 mx-auto mb-10" />
            <p className="font-display italic text-[clamp(26px,5vw,44px)] font-medium text-paper mb-6 leading-tight">
              "A nightly report that finds you,<br />not the other way around."
            </p>
            <p className="text-[17px] font-body leading-relaxed max-w-xl mx-auto mb-10" style={{ color: "rgba(246,243,238,0.62)" }}>
              Configure your WhatsApp number in Settings. At 11 PM every night, InnFlo sends the owner a full operational summary — occupancy, revenue, tomorrow's schedule, housekeeping, maintenance. No login, no dashboard required.
            </p>
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full font-body text-[14.5px]" style={{ background: "rgba(224,83,43,0.14)", border: "1px solid rgba(224,83,43,0.3)" }}>
              <span className="h-2 w-2 rounded-full bg-coral animate-pulse" />
              <span className="text-coral" style={{ color: "#F5A183" }}>Sent automatically at 11:00 PM every night</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── QR & KITCHEN ───────────────────────────────────────────────────── */}
      <section className="py-28 bg-paper overflow-hidden border-t border-line">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-16 items-center">

            {/* ── LEFT: Copy ── */}
            <Reveal>
              <p className="eyebrow text-coral mb-5">QR &amp; Kitchen</p>
              <h2 className="font-display text-[clamp(36px,4.5vw,54px)] font-medium leading-[0.98] text-ink mb-6">
                Every menu<br />is a QR menu now.
              </h2>
              <p className="text-[17px] leading-relaxed mb-10 font-body text-ink-soft">
                Guests scan, browse, and order from their phone — no app, no waiter required. The kitchen sees the ticket in seconds. The folio updates automatically. Zero manual input, end to end.
              </p>

              {/* Flow steps */}
              <ol className="space-y-5 font-body">
                {[
                  {
                    icon: <span className="text-[17px] leading-none">📱</span>,
                    title: "Guest scans the QR",
                    sub: "In-room, on the table, or at the pickup counter",
                  },
                  {
                    icon: <DoorOpen className="w-4 h-4 text-coral" />,
                    title: "Picks delivery type",
                    sub: "Room delivery · Dine in · Pick-up",
                  },
                  {
                    icon: <ShoppingBag className="w-4 h-4 text-coral" />,
                    title: "Picks how to pay",
                    sub: "Pay at spot · Charge to room folio",
                  },
                  {
                    icon: <Utensils className="w-4 h-4 text-coral" />,
                    title: "Kitchen gets it instantly",
                    sub: "KDS screen, with time, table, and room number",
                  },
                  {
                    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
                    title: "Folio updated automatically",
                    sub: "No one types anything. No rounding errors.",
                  },
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <div className="mt-0.5 w-8 h-8 rounded-xl bg-mist border border-line-soft flex items-center justify-center shrink-0">
                      {step.icon}
                    </div>
                    <div>
                      <p className="text-ink text-[15px] font-bold leading-snug">{step.title}</p>
                      <p className="text-[13px] text-ink-mute mt-0.5">{step.sub}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>

            {/* ── RIGHT: Dual mockup — phone + KDS ── */}
            <Reveal delay={0.12} variant="rise">
              <QrKitchenDualMockup />
            </Reveal>

          </div>
        </div>
      </section>

      {/* ── REPORTS ────────────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-16 items-start">
            <Reveal>
              <p className="eyebrow mb-4">Reports</p>
              <h2 className="font-display text-[clamp(30px,4vw,46px)] font-medium leading-tight text-ink mb-6">
                Every number<br />your accountant<br /><span className="text-ink-soft italic">actually expects.</span>
              </h2>
              <p className="text-[17px] text-ink-soft font-body leading-relaxed mb-6">
                Daily reports break down occupancy, revenue by payment method, guest arrivals and departures, shift cash variance, and expenses by category. Monthly reports add ADR, RevPAR, profit margin, top guests, and housekeeping/maintenance summaries.
              </p>
              <p className="text-[14.5px] text-ink-mute font-body">
                FBR invoice submission support for Pakistan tax compliance.
              </p>
            </Reveal>
            <Reveal delay={0.1}><ReportMockup /></Reveal>
          </div>
        </div>
      </section>

      {/* ── CHANNEL MANAGER — in development, full section ──────────────────── */}
      <section id="channels" className="py-24 bg-mist border-y border-line">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[42%_58%] gap-14 items-center">
            <Reveal>
              <div className="flex items-center gap-3 mb-4">
                <p className="eyebrow">Channel Manager</p>
                <span className="text-[10px] font-bold font-body text-coral-dark bg-coral-soft px-2.5 py-1 rounded-full uppercase tracking-wider">
                  In development
                </span>
              </div>
              <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-medium leading-tight text-ink mb-5">
                Every channel.<br /><span className="text-coral-dark italic">One calendar.</span>
              </h2>
              <p className="text-[15.5px] text-ink-soft font-body leading-relaxed mb-6 max-w-lg">
                Booking.com, Airbnb, Expedia, and Agoda all sync into a single InnFlo calendar — a booking on one channel closes the room everywhere else, automatically. This is what we're building toward: no manual rate updates, no double-booked rooms, no spreadsheet reconciling five different extranets.
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 font-body text-[13.5px] text-ink-soft mb-8">
                {["Booking.com", "Airbnb", "Expedia", "Agoda", "Bookme.pk", "Sastaticket.pk"].map(f => (
                  <p key={f} className="flex items-center gap-2"><span className="text-coral">—</span>{f}</p>
                ))}
              </div>
              <Link
                to="/contact"
                className="inline-flex h-11 px-7 rounded-full text-[14.5px] font-semibold font-body border border-coral text-coral-dark hover:bg-coral-soft transition-colors items-center"
              >
                Get notified when it launches
              </Link>
            </Reveal>

            <Reveal delay={0.1}>
              <ChannelManagerFlowMockup />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FAQ — got a question ─────────────────────────────────────────────── */}
      <section className="pb-24">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal variant="fade" className="text-center mb-14">
            <h2 className="font-display text-[clamp(30px,4vw,44px)] font-medium leading-tight text-ink">
              Got a question?
            </h2>
          </Reveal>

          <Reveal variant="rise">
            <div className="border-t border-line">
              {FEATURE_FAQS.map((item, i) => (
                <FeatureFaqRow
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  isOpen={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

    </div>
  );
}
