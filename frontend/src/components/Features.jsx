import React from 'react';
import { Zap, Globe, BookOpen } from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, description, colorClass }) => (
  <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 text-center hover:border-white/20 transition-colors">
    <div className={`w-12 h-12 ${colorClass} rounded-xl flex items-center justify-center mx-auto mb-6`}>
      <Icon size={24} />
    </div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-gray-400 leading-relaxed">{description}</p>
  </div>
);

const Features = () => {
  const features = [
    {
      icon: Zap,
      title: "Instant Output",
      description: "Watch your code come to life the moment you press enter.",
      colorClass: "bg-indigo-500/20 text-indigo-400"
    },
    {
      icon: Globe,
      title: "Free AI Models",
      description: "High-quality coding education powered by free open-source AI.",
      colorClass: "bg-cyan-500/20 text-cyan-400"
    },
    {
      icon: BookOpen,
      title: "Beginner Friendly",
      description: "No complex setups. Just one prompt to start your journey.",
      colorClass: "bg-purple-500/20 text-purple-400"
    }
  ];

  return (
    <section className="py-20 max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
      {features.map((f, index) => (
        <FeatureCard key={index} {...f} />
      ))}
    </section>
  );
};

export default Features;