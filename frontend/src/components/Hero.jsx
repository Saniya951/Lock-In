import React from 'react';
import { ChevronRight } from 'lucide-react';

const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden text-center px-6">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full -z-10" />
      <h1 className="text-5xl md:text-7xl font-black mb-8 leading-tight">
        Code with <br />
        <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          One Prompt.
        </span>
      </h1>
      <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
        The beginner-friendly AI engine that turns your natural language into 
        working applications instantly.
      </p>
      <button className="flex items-center gap-2 mx-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg transition-all hover:scale-105 shadow-lg shadow-indigo-500/20">
        Start Coding with One Prompt <ChevronRight size={20} />
      </button>
    </section>
  );
};

export default Hero;