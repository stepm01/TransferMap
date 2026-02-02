import React from 'react';
import { CheckCircle, Circle, BookOpen, TrendingUp, Target, User, Mail, Building2 } from 'lucide-react';

const Dashboard = ({ verificationResults, user }) => {
  if (!verificationResults) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass rounded-2xl p-12 text-center max-w-md">
          <div className="relative mb-6">
            <div className="w-32 h-32 mx-auto rounded-2xl bg-white/5 backdrop-blur-xl flex items-center justify-center border border-white/10">
              <span className="text-6xl">🔒</span>
            </div>
          </div>
          <h3 className="text-white text-xl font-semibold mb-3">Dashboard Locked</h3>
          <p className="text-white/60 leading-relaxed">
            Please complete the steps to view your dashboard.
          </p>
        </div>
      </div>
    );
  };

  const { summary, major_requirements } = verificationResults;
  const totalCourses = major_requirements.completed.length + major_requirements.missing.length;
  const completedCourses = major_requirements.completed.length;
  const readinessPercentage = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
  const unitsNeeded = Math.max(0, 60 - summary.total_units);

  // Calculate SVG circle properties for pie chart
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (readinessPercentage / 100) * circumference;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Top Panel - Grid of 4 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* 1. User Stats */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-ucsc-gold to-yellow-400 flex items-center justify-center shadow-lg">
              <User className="w-6 h-6 text-ucsc-blue" />
            </div>
            <div>
              <h4 className="text-white font-semibold">{user.name || 'Student'}</h4>
              <p className="text-white/50 text-xs">Transfer Student</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white/70">
              <Mail className="w-4 h-4 text-ucsc-gold flex-shrink-0" />
              <span className="text-sm truncate">{user.email || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <Building2 className="w-4 h-4 text-ucsc-gold flex-shrink-0" />
              <span className="text-sm">{user.communityCollege || '—'}</span>
            </div>
          </div>
        </div>

        {/* 2. Pathway Header */}
        <div className="glass rounded-2xl p-6 flex flex-col justify-center">
          <h2 className="font-display text-2xl font-bold text-white mb-2">
            {summary.major}
          </h2>
          <p className="text-white/60 text-sm mb-1">Pathway To</p>
          <h3 className="text-xl font-semibold text-ucsc-gold flex items-center gap-2">
            <Target className="w-5 h-5" />
            {summary.target_uc}
          </h3>
        </div>

        {/* 3. Units & GPA Stacked */}
        <div className="space-y-4">
          {/* Units Box */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
              <h4 className="text-white/70 font-medium text-sm">Units Remaining</h4>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{unitsNeeded}</p>
            <p className="text-white/50 text-xs">
              {summary.total_units} / 60 completed
            </p>
            {unitsNeeded === 0 && (
              <div className="mt-2 p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded">
                <p className="text-emerald-400 text-xs text-center">✓ Met!</p>
              </div>
            )}
          </div>

          {/* GPA Box */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Target className="w-4 h-4 text-purple-400" />
              </div>
              <h4 className="text-white/70 font-medium text-sm">Current GPA</h4>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{summary.gpa}</p>
            <p className="text-white/50 text-xs">Min: 3.0 recommended</p>
            {parseFloat(summary.gpa) >= 3.0 ? (
              <div className="mt-2 p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded">
                <p className="text-emerald-400 text-xs text-center">✓ Above min!</p>
              </div>
            ) : (
              <div className="mt-2 p-1.5 bg-amber-500/10 border border-amber-500/30 rounded">
                <p className="text-amber-400 text-xs text-center">Below min</p>
              </div>
            )}
          </div>
        </div>

        {/* 4. Pie Chart */}
        <div className="glass rounded-2xl p-6 flex flex-col">
          <h4 className="text-white font-medium mb-3 text-center text-sm">Transfer Readiness (Percentage of Major Prep Courses Done) </h4>
          
          <div className="flex-1 flex items-center justify-center">
            <div className="relative">
              <svg width="150" height="150" className="transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="75"
                  cy="75"
                  r={radius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="12"
                />
                {/* Progress circle */}
                <circle
                  cx="75"
                  cy="75"
                  r={radius}
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="12"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F8E9A1" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
              </svg>
              
              {/* Center percentage */}
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <p className="text-3xl font-bold text-white">{readinessPercentage}%</p>
                <p className="text-white/50 text-xs mt-1">Complete</p>
              </div>
            </div>
          </div>

          {/* Status indicator */}
          <div className="mt-3">
            {readinessPercentage === 100 ? (
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <p className="text-emerald-400 text-xs font-medium text-center">
                  ✓ All prep complete!
                </p>
              </div>
            ) : readinessPercentage >= 50 ? (
              <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-400 text-xs font-medium text-center">
                  On track
                </p>
              </div>
            ) : (
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-amber-400 text-xs font-medium text-center">
                  More needed
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Panel - Checklist */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-white font-semibold text-xl mb-6 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-ucsc-gold" />
          Major Preparation Courses
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Completed Courses */}
          {major_requirements.completed.map((req, idx) => (
            <div 
              key={`completed-${idx}`} 
              className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/15 transition-colors"
            >
              <div className="flex-shrink-0 mt-0.5">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{req.name}</p>
                <p className="text-emerald-300/70 text-xs mt-1 truncate">
                  {req.codes.join(' or ')}
                </p>
              </div>
            </div>
          ))}

          {/* Missing Courses */}
          {major_requirements.missing.map((req, idx) => (
            <div 
              key={`missing-${idx}`} 
              className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
            >
              <div className="flex-shrink-0 mt-0.5">
                <Circle className="w-5 h-5 text-white/40" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 font-medium text-sm">{req.name}</p>
                <p className="text-white/50 text-xs mt-1 truncate">
                  Take: {req.codes.join(' or ')}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Progress Summary */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/70 text-sm">Overall Progress</span>
            <span className="text-ucsc-gold font-semibold text-sm">
              {completedCourses} of {totalCourses} courses completed
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-ucsc-gold to-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${readinessPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;