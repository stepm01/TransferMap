import React, { useState, useEffect, useRef } from 'react';
import { 
  GraduationCap, Upload, CheckCircle2, Circle, User, Mail, Building2, BookOpen,
  ArrowRight, AlertTriangle, ExternalLink, Plus, Trash2, Loader2, CheckCircle,
  XCircle, AlertCircle, Sparkles, ChevronRight, School, Menu, X, Info, HelpCircle, Users,
  LogOut, FileText, Edit3, Trash,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

import Dashboard from './Dashboard';
import { useGoogleAuth } from './useGoogleAuth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from './firebase';
import { addCourseToTranscript, removeCourseFromTranscript } from './fireData';
const db = getFirestore();

// ==================== OPENROUTER CONFIGURATION ====================
const AI_PROVIDER = "groq";

// Groq (FREE - 14,400 requests/day)
const GROQ_API_KEY = "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"; // <-- Paste your key
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile"; // Fast & capable

// OpenRouter (PAID - Claude)
//const OPENROUTER_API_KEY = "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";
//const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
//const OPENROUTER_MODEL = "anthropic/claude-sonnet-4";

// ==================== COLLEGE DATA ====================
const UC_CAMPUSES = [
  { id: "ucsc", name: "UC Santa Cruz", available: true, mascot: "🍌" },
  { id: "ucb", name: "UC Berkeley", available: false },
  { id: "ucla", name: "UCLA", available: false },
  { id: "ucsd", name: "UC San Diego", available: true },
  { id: "ucd", name: "UC Davis", available: false },
  { id: "uci", name: "UC Irvine", available: false },
  { id: "ucr", name: "UC Riverside", available: false },
  { id: "ucsb", name: "UC Santa Barbara", available: false },
  { id: "ucm", name: "UC Merced", available: false },
];

const COMMUNITY_COLLEGES = [
  "De Anza College", "Foothill College", "Mission College", "West Valley College",
  "Ohlone College", "San Jose City College", "Evergreen Valley College",
  "Chabot College", "Las Positas College", "Diablo Valley College",
  "Contra Costa College", "Santa Rosa Junior College", "College of San Mateo",
  "Skyline College", "Cañada College", "City College of San Francisco",
  "Merritt College", "Laney College", "Berkeley City College", "College of Alameda",
];

const MAJORS_BY_UC = {
  "ucsc": ["Computer Science", "Biology", "Psychology", "Mathematics", "Physics", "Chemistry", "Economics", "Environmental Studies"],
  "ucsd": ["Computer Science", "Biology", "Psychology", "Mathematics", "Physics", "Chemistry", "Economics", "Cognitive Science", "Data Science"],
  "default": ["Computer Science", "Biology", "Psychology", "Mathematics", "Physics", "Chemistry", "Economics"],
};

// ==================== AI CALL (SUPPORTS GROQ & OPENROUTER) ====================
const callAI = async (prompt, maxTokens = 2000) => {
  const isGroq = AI_PROVIDER === "groq";
  
  const apiKey = isGroq ? GROQ_API_KEY : OPENROUTER_API_KEY;
  const baseUrl = isGroq ? GROQ_BASE_URL : OPENROUTER_BASE_URL;
  const model = isGroq ? GROQ_MODEL : OPENROUTER_MODEL;
  
  console.log(`🤖 Calling ${isGroq ? 'Groq (Llama)' : 'OpenRouter (Claude)'}...`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    
    // OpenRouter needs extra headers
    if (!isGroq) {
      headers['HTTP-Referer'] = window.location.origin || 'http://localhost:5173';
      headers['X-Title'] = 'TransferMap';
    }
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: maxTokens
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${response.status}`, errorText);
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error(`❌ AI Error:`, data.error.message);
      throw new Error(data.error.message);
    }
    
    console.log(`✅ ${isGroq ? 'Groq' : 'Claude'} responded successfully`);
    return data.choices[0]?.message?.content || "";
    
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  }
};


// ==================== PDF TEXT EXTRACTION ====================
const extractTextFromPDF = async (file, onProgress) => {
  try {
    onProgress?.("Loading PDF...");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 10);
    
    for (let i = 1; i <= maxPages; i++) {
      onProgress?.(`Reading page ${i}/${maxPages}...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map(item => item.str).join(' ') + '\n';
    }
    
    // Truncate if too long
    if (fullText.length > 12000) fullText = fullText.substring(0, 12000);
    
    return fullText;
  } catch (error) {
    throw new Error('Failed to read PDF. Make sure it\'s a valid, text-based PDF.');
  }
};

// ==================== AI TRANSCRIPT PARSER ====================
const parseTranscriptWithAI = async (text, onProgress) => {
  onProgress?.("AI analyzing transcript...");
  
  const prompt = `Extract college courses from this transcript. Return ONLY a JSON array.

Format: [{"courseCode":"MATH 1A","courseName":"Calculus I","units":5,"grade":"A","semester":"Fall 2023"}]

Transcript:
${text.substring(0, 10000)}`;

  const content = await callAI(prompt, 2000);
  
  // Clean and parse
  let clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const match = clean.match(/\[[\s\S]*\]/);
  
  if (match) {
    const courses = JSON.parse(match[0]);
    return courses.map((c, i) => ({ 
      id: Date.now() + i, 
      courseCode: c.courseCode || "UNKNOWN", 
      courseName: c.courseName || "Unknown", 
      units: parseFloat(c.units) || 3, 
      grade: c.grade || "P", 
      semester: c.semester || "Unknown" 
    }));
  }
  throw new Error("Could not find courses in transcript");
};

// ==================== AI VERIFICATION ====================
const verifyWithAI = async (courses, major, targetUC) => {
  const coursesText = courses.map(c => `${c.courseCode} - ${c.courseName} (${c.units}u, ${c.grade})`).join('\n');
  
  const prompt = `Analyze these community college courses for UC transfer to ${targetUC} as ${major} major.

STUDENT'S COURSES:
${coursesText}

MAJOR REQUIREMENTS: ${getMajorRequirements(major)}

TASK:
1. Calculate GPA using: A=4.0, A-=3.7, B+=3.3, B=3.0, B-=2.7, C+=2.3, C=2.0, C-=1.7, D=1.0, F=0
2. Determine which major prep courses are completed vs missing
3. Check ALL 11 IGETC areas - determine which courses satisfy each area

IGETC AREAS:
- 1A: English Composition (EWRT 1A, ENGL 1A, etc.)
- 1B: Critical Thinking/Writing (EWRT 2, ENGL 1B, etc.)
- 1C: Oral Communication (COMM 1, SPCH 1, etc.)
- 2: Mathematical Concepts (any MATH course)
- 3A: Arts (ART, MUS, THEA, DANC courses)
- 3B: Humanities (PHIL, HIST, HUMN, LIT courses)
- 4: Social/Behavioral Sciences (PSYCH, SOC, POLI, ECON, ANTH courses)
- 5A: Physical Science (PHYS, CHEM, GEOL, ASTR courses)
- 5B: Biological Science (BIOL, ZOOL courses)
- 5C: Lab Science (any lab component from 5A or 5B)
- 6: Language Other Than English (SPAN, FREN, ASL, CHIN, JAPN, etc.)

Return ONLY valid JSON (no markdown):
{"eligibility_status":"likely_eligible","summary":{"gpa":"3.50","total_units":30,"major":"${major}","target_uc":"${targetUC}"},"major_requirements":{"completed":[{"name":"Calculus I","matched_course":"MATH 1A - Calculus I"}],"missing":[{"name":"Linear Algebra","codes":["MATH 21","MATH 6"]}]},"risks":[{"type":"Units","severity":"high","message":"Need 60 units minimum"}],"igetc_status":{"1A":{"name":"English Composition","completed":true,"satisfied_by":"EWRT 1A - English Composition","courses_needed":[]},"1B":{"name":"Critical Thinking","completed":false,"satisfied_by":null,"courses_needed":["EWRT 2","ENGL 1B"]},"1C":{"name":"Oral Communication","completed":false,"satisfied_by":null,"courses_needed":["COMM 1","SPCH 1"]},"2":{"name":"Mathematical Concepts","completed":true,"satisfied_by":"MATH 1A - Calculus I","courses_needed":[]},"3A":{"name":"Arts","completed":false,"satisfied_by":null,"courses_needed":["ART 1","MUS 1"]},"3B":{"name":"Humanities","completed":false,"satisfied_by":null,"courses_needed":["PHIL 1","HIST 4A"]},"4":{"name":"Social Sciences","completed":false,"satisfied_by":null,"courses_needed":["PSYCH 1","SOC 1"]},"5A":{"name":"Physical Science","completed":true,"satisfied_by":"PHYS 4A - Physics","courses_needed":[]},"5B":{"name":"Biological Science","completed":false,"satisfied_by":null,"courses_needed":["BIOL 6A"]},"5C":{"name":"Lab Science","completed":true,"satisfied_by":"PHYS 4A Lab","courses_needed":[]},"6":{"name":"Language Other Than English","completed":false,"satisfied_by":null,"courses_needed":["SPAN 1","FREN 1","ASL 1"]}},"notes":["Strong progress on major requirements"],"sources":{"assist_org":"https://assist.org"}}`;

  const content = await callAI(prompt, 3000);
  
  let clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const match = clean.match(/\{[\s\S]*\}/);
  
  if (match) {
    const r = JSON.parse(match[0]);
    return {
      eligibility_status: r.eligibility_status || "conditional",
      summary: r.summary || { gpa: "0", total_units: 0, major, target_uc: targetUC },
      major_requirements: r.major_requirements || { completed: [], missing: [] },
      risks: r.risks || [],
      igetc_status: r.igetc_status || {},
      notes: r.notes || [],
      sources: r.sources || { assist_org: "https://assist.org" }
    };
  }
  throw new Error("Could not parse results");
};

const getMajorRequirements = (major) => {
  const reqs = {
    "Computer Science": "Calc I&II, Intro Programming, Data Structures, Linear Algebra, Physics. GPA 3.0+, 60 units",
    "Biology": "Bio I&II, Chem I&II, Organic Chem, Calc, Physics. GPA 2.8+, 60 units",
    "Psychology": "Intro Psych, Stats, Research Methods, Bio. GPA 2.5+, 60 units",
    "Mathematics": "Calc I-III, Linear Algebra, Diff Eq. GPA 3.0+, 60 units",
    "Physics": "Calc I-III, Physics I-III, Linear Algebra. GPA 3.0+, 60 units",
    "Chemistry": "Chem I&II, Organic I&II, Calc, Physics. GPA 3.0+, 60 units",
    "Economics": "Micro, Macro, Calc, Stats. GPA 3.0+, 60 units",
  };
  return reqs[major] || reqs["Computer Science"];
};

const generateFallbackResults = (courses, major, errorMsg) => {
  const gp = { "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7, "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "F": 0 };
  let tp = 0, tu = 0;
  courses.forEach(c => { tp += (gp[c.grade] || 0) * c.units; tu += c.units; });
  const gpa = tu > 0 ? (tp / tu).toFixed(2) : "0.00";
  return {
    eligibility_status: parseFloat(gpa) >= 3.0 && tu >= 60 ? "likely_eligible" : "conditional",
    summary: { gpa, total_units: tu, major, target_uc: "UC" },
    major_requirements: { completed: [], missing: [{ name: "AI unavailable", codes: ["Try again"] }] },
    risks: [{ type: "Error", severity: "medium", message: errorMsg }],
    igetc_status: {},
    notes: ["Please try again or enter courses manually."],
    sources: { assist_org: "https://assist.org" }
  };
};

const updateUserFirestoreField = async (uid, fields) => {
  if (!uid) return;
  try { await setDoc(doc(db, "userInformation", uid), fields, { merge: true }); } catch (err) {}
};

// ==================== MAIN APP ====================
function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedUC, setSelectedUC] = useState(null);
  const [courses, setCourses] = useState([]);
  const [verificationResults, setVerificationResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newCourse, setNewCourse] = useState({ courseCode: '', courseName: '', units: 3, grade: 'A', semester: 'Fall 2024' });
  const { user, isAuthenticated, showSignUp, handleGoogleSignIn, setUser, setShowSignUp, setIsAuthenticated } = useGoogleAuth();
  const [currentPage, setCurrentPage] = useState('home');
  const [isParsingTranscript, setIsParsingTranscript] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [parseProgress, setParseProgress] = useState('');
  const [verificationError, setVerificationError] = useState(null);
  const fileInputRef = useRef(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [igetcPopup, setIgetcPopup] = useState(null);

  const getAvailableMajors = () => MAJORS_BY_UC[selectedUC] || MAJORS_BY_UC.default;

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user.uid) return;
      try {
        const userSnap = await getDoc(doc(db, "userInformation", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (!user.major && data.major) setUser(prev => ({ ...prev, major: data.major }));
          if (!user.communityCollege && data.communityCollege) setUser(prev => ({ ...prev, communityCollege: data.communityCollege }));
          if ((data.major || user.major) && (data.communityCollege || user.communityCollege)) setCurrentStep(1);
          if (data.targetUC) { setSelectedUC(data.targetUC); setUser(prev => ({ ...prev, targetUC: data.targetUC })); setCurrentStep(2); }
          
          // Load saved verification results
          if (data.lastVerification) {
            setVerificationResults(data.lastVerification);
            console.log("✅ Loaded saved verification results from Firebase");
          }
        }
      } catch (err) {}
    };
    fetchUserProfile();
  }, [user.uid]);

  useEffect(() => {
    const fetchTranscript = async () => {
      if (!user.uid) return;
      try {
        const snap = await getDoc(doc(db, "userInformation", user.uid));
        if (snap.exists() && snap.data().transcript) setCourses(snap.data().transcript);
      } catch (err) {}
    };
    fetchTranscript();
  }, [user.uid]);

  useEffect(() => {
    if (!profileDropdownOpen) return;
    const handleClick = (e) => { if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) setProfileDropdownOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileDropdownOpen]);

  const steps = [
    { id: 1, label: "Choose UC", icon: School, completed: selectedUC !== null },
    { id: 2, label: "Transcript", icon: Upload, completed: courses.length > 0 },
    { id: 3, label: "Results", icon: CheckCircle2, completed: verificationResults !== null },
  ];

  const handleProfileSubmit = (e) => { 
    e.preventDefault(); 
    if (user.name && user.major && user.communityCollege) { setCurrentStep(1); setIsEditingProfile(false); }
  };

  const addCourse = async () => {
    if (newCourse.courseCode && newCourse.courseName) {
      const c = { ...newCourse, id: Date.now() };
      setCourses(prev => [...prev, c]);
      setNewCourse({ courseCode: '', courseName: '', units: 3, grade: 'A', semester: 'Fall 2024' });
      if (user?.uid) try { await addCourseToTranscript(user.uid, c); } catch (err) {}
    }
  };

  const removeCourse = async (id) => {
    setCourses(prev => prev.filter(c => c.id !== id));
    if (user?.uid) try { await removeCourseFromTranscript(user.uid, id); } catch (err) {}
  };

  const clearAllCourses = async () => {
    setCourses([]);
    if (user?.uid) try { await updateUserFirestoreField(user.uid, { transcript: [] }); } catch (err) {}
  };

  const runVerification = async () => {
    setIsLoading(true);
    setVerificationError(null);
    try {
      const ucName = UC_CAMPUSES.find(uc => uc.id === selectedUC)?.name || 'UC Santa Cruz';
      const results = await verifyWithAI(courses, user.major, ucName);
      setVerificationResults(results);
      setCurrentStep(3);
      
      // Save verification results to Firebase
      if (user?.uid) {
        await updateUserFirestoreField(user.uid, { 
          lastVerification: results,
          lastVerificationDate: new Date().toISOString(),
          lastVerificationMajor: user.major,
          lastVerificationUC: ucName
        });
        console.log("✅ Verification results saved to Firebase");
      }
    } catch (error) {
      setVerificationError(error.message);
      setVerificationResults(generateFallbackResults(courses, user.major, error.message));
      setCurrentStep(3);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscriptUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsParsingTranscript(true);
    setParseError(null);
    setParseProgress("Starting...");
    
    try {
      if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error("Please upload a PDF file.");
      if (file.size > 10 * 1024 * 1024) throw new Error("File too large (max 10MB).");
      
      const text = await extractTextFromPDF(file, setParseProgress);
      if (text.length < 100) throw new Error("Could not extract text. PDF may be scanned/image-based.");
      
      const parsed = await parseTranscriptWithAI(text, setParseProgress);
      if (parsed?.length > 0) {
        setCourses(prev => [...prev, ...parsed]);
        setParseProgress(`✅ Found ${parsed.length} courses!`);
        setTimeout(() => setParseProgress(''), 3000);
      } else throw new Error("No courses found.");
    } catch (err) {
      setParseError(err.message);
      setParseProgress('');
    } finally {
      setIsParsingTranscript(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUCSelect = async (ucId) => {
    setSelectedUC(ucId);
    if (user.uid) { await updateUserFirestoreField(user.uid, { targetUC: ucId }); setUser(prev => ({ ...prev, targetUC: ucId })); }
    setCurrentStep(2);
  };

  const updateProfileField = async (field, value) => {
    setUser(prev => ({ ...prev, [field]: value }));
    if (user.uid) await updateUserFirestoreField(user.uid, { [field]: value });
  };

  // Editable Profile Field
  const EditableProfileField = ({ icon: Icon, value, field, options }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const handleSave = () => { updateProfileField(field, tempValue); setIsEditing(false); };
    if (isEditing) {
      return (
        <div className="flex items-center gap-2 text-white/80 p-2 bg-white/10 rounded-lg">
          <Icon className="w-4 h-4 text-ucsc-gold flex-shrink-0" />
          {options ? (
            <select value={tempValue} onChange={(e) => setTempValue(e.target.value)} className="flex-1 bg-transparent text-white text-sm outline-none" autoFocus>
              <option value="">Select...</option>
              {options.map(opt => <option key={opt} value={opt} className="text-black">{opt}</option>)}
            </select>
          ) : (
            <input type="text" value={tempValue} onChange={(e) => setTempValue(e.target.value)} className="flex-1 bg-transparent text-white text-sm outline-none" autoFocus />
          )}
          <button onClick={handleSave} className="text-emerald-400"><CheckCircle className="w-4 h-4" /></button>
          <button onClick={() => { setIsEditing(false); setTempValue(value); }} className="text-red-400"><XCircle className="w-4 h-4" /></button>
        </div>
      );
    }
    return (
      <div onClick={() => setIsEditing(true)} className="flex items-center gap-3 text-white/80 cursor-pointer hover:bg-white/10 p-2 rounded-lg group">
        <Icon className="w-4 h-4 text-ucsc-gold" /><span className="text-sm flex-1">{value || '—'}</span>
        <Edit3 className="w-3 h-3 text-white/40 opacity-0 group-hover:opacity-100" />
      </div>
    );
  };

  const renderNavBar = () => (
    <nav className="glass rounded-2xl mb-6 relative z-[100]">
      <div className="px-6 py-4 flex items-center justify-between">
        <button onClick={() => setCurrentPage('home')} className="flex items-center gap-3 hover:opacity-80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ucsc-gold to-yellow-400 flex items-center justify-center"><GraduationCap className="w-6 h-6 text-ucsc-blue" /></div>
          <span className="font-display font-bold text-white text-lg hidden md:block">TransferMap</span>
        </button>
        <div className="hidden md:flex items-center gap-4">
          {['about', 'faqs', 'info', 'dashboard'].map(p => (
            <button key={p} onClick={() => setCurrentPage(p)} className={`px-3 py-2 rounded-lg text-sm ${currentPage === p ? 'bg-ucsc-gold/20 text-ucsc-gold' : 'text-white/70 hover:bg-white/10'}`}>
              {p === 'faqs' ? 'FAQs' : p === 'info' ? 'Resources' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          {isAuthenticated && (
            <div className="relative" ref={profileDropdownRef}>
              <button onClick={() => setProfileDropdownOpen(v => !v)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white">
                <User className="w-4 h-4 text-ucsc-gold" />{user.name?.split(" ")[0] || "Profile"}
              </button>
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl z-[200] p-2 border border-gray-200">
                  <button onClick={() => { setIsEditingProfile(true); setProfileDropdownOpen(false); }} className="w-full px-4 py-3 text-left rounded-lg bg-ucsc-gold text-ucsc-blue font-semibold hover:bg-yellow-400 mb-1 flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />Edit Profile
                  </button>
                  <button onClick={async () => { await auth.signOut(); window.location.reload(); }} className="w-full px-4 py-3 text-left rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 flex items-center gap-2">
                    <LogOut className="w-4 h-4" />Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );

  const renderLeftPanel = () => (
    <div className="flex flex-col h-full">
      <div className="glass rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-ucsc-gold to-yellow-400 flex items-center justify-center"><User className="w-7 h-7 text-ucsc-blue" /></div>
          <div><h3 className="font-bold text-white text-lg">{user.name || 'Profile'}</h3><p className="text-white/60 text-sm">Transfer Student</p></div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-white/80 p-2"><Mail className="w-4 h-4 text-ucsc-gold" /><span className="text-sm truncate">{user.email || '—'}</span></div>
          <EditableProfileField icon={User} value={user.name} field="name" />
          <EditableProfileField icon={Building2} value={user.communityCollege} field="communityCollege" options={COMMUNITY_COLLEGES} />
          <EditableProfileField icon={BookOpen} value={user.major} field="major" options={getAvailableMajors()} />
        </div>
      </div>
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === idx + 1;
          const canGo = isAuthenticated && (idx === 0 || steps[idx - 1].completed || idx < currentStep - 1);
          return (
            <button key={step.id} onClick={() => canGo && setCurrentStep(idx + 1)} disabled={!canGo} className={`w-full flex items-center gap-4 p-4 rounded-xl ${isActive ? 'glass border border-ucsc-gold/30' : 'bg-white/5'} ${!canGo ? 'opacity-50' : 'hover:bg-white/10'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step.completed ? 'bg-ucsc-gold' : isActive ? 'border-2 border-ucsc-gold' : 'bg-white/10'}`}>
                {step.completed ? <CheckCircle2 className="w-5 h-5 text-ucsc-blue" /> : <Icon className={`w-5 h-5 ${isActive ? 'text-ucsc-gold' : 'text-white/60'}`} />}
              </div>
              <div className="text-left"><p className={isActive ? 'text-white font-medium' : 'text-white/70'}>Step {step.id}</p><p className={isActive ? 'text-ucsc-gold text-sm' : 'text-white/50 text-sm'}>{step.label}</p></div>
            </button>
          );
        })}
      </div>
      <div className="mt-auto pt-6"><div className="glass-dark rounded-xl p-4 text-center"><p className="text-white/60 text-xs">Powered by</p><p className="text-white font-bold">CruzHacks 2025</p></div></div>
    </div>
  );

  const renderWelcomeScreen = () => (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-ucsc-gold to-yellow-400 flex items-center justify-center"><GraduationCap className="w-12 h-12 text-ucsc-blue" /></div>
      <h1 className="text-4xl font-bold text-white mb-4">UC Transfer<br /><span className="text-ucsc-gold">Verifier</span></h1>
      <p className="text-white/70 mb-8 max-w-md">AI-powered transfer eligibility verification</p>
      {!showSignUp ? (
        <button onClick={handleGoogleSignIn} className="btn-primary flex items-center gap-3">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign in with Google
        </button>
      ) : (
        <form onSubmit={handleProfileSubmit} className="w-full max-w-sm space-y-4">
          <div className="glass rounded-xl p-4"><p className="text-white/60 text-xs">Signed in as</p><p className="text-white">{user.email}</p></div>
          <input type="text" value={user.name || ''} onChange={(e) => setUser({ ...user, name: e.target.value })} placeholder="Your Name" className="input-field" required />
          <select value={user.communityCollege || ''} onChange={(e) => updateProfileField('communityCollege', e.target.value)} className="input-field" required>
            <option value="">Select College</option>
            {COMMUNITY_COLLEGES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={user.major || ''} onChange={(e) => updateProfileField('major', e.target.value)} className="input-field" required>
            <option value="">Select Major</option>
            {MAJORS_BY_UC.default.map(m => <option key={m}>{m}</option>)}
          </select>
          <button type="submit" className="btn-primary w-full">Continue →</button>
        </form>
      )}
    </div>
  );

  const renderUCSelection = () => (
    <div>
      <h2 className="text-3xl font-bold text-white mb-2">Choose Your Target UC</h2>
      <p className="text-white/60 mb-8">Select the campus you want to transfer to.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {UC_CAMPUSES.map(uc => (
          <button key={uc.id} onClick={() => uc.available && handleUCSelect(uc.id)} disabled={!uc.available} className={`p-5 rounded-xl border-2 text-left ${selectedUC === uc.id ? 'border-ucsc-gold bg-ucsc-gold/10' : 'border-white/10 bg-white/5'} ${!uc.available ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/30'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 ${selectedUC === uc.id ? 'border-ucsc-gold bg-ucsc-gold' : 'border-white/40'}`} />
              <span className="text-white font-medium flex-1">{uc.name}</span>
              {uc.mascot && <span className="text-2xl">{uc.mascot}</span>}
            </div>
            {!uc.available && <p className="text-white/40 text-xs mt-2">Coming soon</p>}
          </button>
        ))}
      </div>
    </div>
  );

  const renderTranscriptEntry = () => (
    <div>
      <h2 className="text-3xl font-bold text-white mb-2">Enter Your Courses</h2>
      <p className="text-white/60 mb-8">Upload PDF transcript or add manually.</p>
      
      {/* PDF Upload */}
      <div className="glass rounded-xl p-6 mb-6 border border-ucsc-gold/30">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-ucsc-gold" />Upload PDF Transcript</h3>
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleTranscriptUpload} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} disabled={isParsingTranscript} className="btn-secondary flex items-center gap-2">
          {isParsingTranscript ? <><Loader2 className="w-4 h-4 animate-spin" />{parseProgress}</> : <><Upload className="w-4 h-4" />Upload PDF</>}
        </button>
        {parseProgress && !isParsingTranscript && !parseError && <p className="mt-3 text-emerald-400 text-sm">{parseProgress}</p>}
        {parseError && <p className="mt-3 text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{parseError}</p>}
      </div>

      {/* Manual Entry */}
      <div className="glass rounded-xl p-6 mb-6">
        <h3 className="text-white font-semibold mb-4"><Plus className="w-5 h-5 inline mr-2 text-ucsc-gold" />Add Manually</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input type="text" value={newCourse.courseCode} onChange={(e) => setNewCourse({ ...newCourse, courseCode: e.target.value.toUpperCase() })} placeholder="MATH 1A" className="input-field" />
          <input type="text" value={newCourse.courseName} onChange={(e) => setNewCourse({ ...newCourse, courseName: e.target.value })} placeholder="Calculus I" className="input-field" />
          <input type="number" value={newCourse.units} onChange={(e) => setNewCourse({ ...newCourse, units: parseFloat(e.target.value) })} min="1" max="10" className="input-field" />
          <select value={newCourse.grade} onChange={(e) => setNewCourse({ ...newCourse, grade: e.target.value })} className="input-field">{['A','A-','B+','B','B-','C+','C','C-','D','F','P'].map(g => <option key={g}>{g}</option>)}</select>
          <select value={newCourse.semester} onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })} className="input-field">{['Fall 2024','Spring 2024','Fall 2023','Spring 2023'].map(s => <option key={s}>{s}</option>)}</select>
          <button onClick={addCourse} disabled={!newCourse.courseCode || !newCourse.courseName} className="btn-secondary disabled:opacity-50">Add</button>
        </div>
      </div>

      {/* Course List */}
      {courses.length > 0 && (
        <div className="glass rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-semibold">Courses ({courses.length})</h3>
            <button onClick={clearAllCourses} className="text-red-400 text-sm flex items-center gap-1 hover:text-red-300"><Trash className="w-4 h-4" />Clear All</button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {courses.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-ucsc-gold">{c.courseCode}</span>
                  <span className="text-white/80">{c.courseName}</span>
                  <span className="text-white/50 text-sm">{c.units}u</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-sm ${['A','A-'].includes(c.grade) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'}`}>{c.grade}</span>
                  <button onClick={() => removeCourse(c.id)} className="text-white/40 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demo */}
      <div className="glass-dark rounded-xl p-4 mb-6">
        <button onClick={() => setCourses([
          { id: 1, courseCode: 'MATH 1A', courseName: 'Calculus I', units: 5, grade: 'A', semester: 'Fall 2023' },
          { id: 2, courseCode: 'MATH 1B', courseName: 'Calculus II', units: 5, grade: 'A-', semester: 'Spring 2024' },
          { id: 3, courseCode: 'CIS 22A', courseName: 'Intro to Programming', units: 4.5, grade: 'B+', semester: 'Fall 2023' },
          { id: 4, courseCode: 'CIS 22B', courseName: 'Data Structures', units: 4.5, grade: 'B', semester: 'Spring 2024' },
          { id: 5, courseCode: 'EWRT 1A', courseName: 'English Composition', units: 5, grade: 'A', semester: 'Fall 2023' },
          { id: 6, courseCode: 'PHYS 4A', courseName: 'Physics', units: 5, grade: 'B+', semester: 'Fall 2024' },
        ])} className="text-ucsc-gold text-sm hover:underline"><Sparkles className="w-4 h-4 inline mr-1" />Load sample →</button>
      </div>

      <div className="flex gap-4">
        <button onClick={() => setCurrentStep(1)} className="btn-secondary">Back</button>
        <button onClick={runVerification} disabled={!courses.length || isLoading} className={`btn-primary ${(!courses.length || isLoading) && 'opacity-50'}`}>
          {isLoading ? <><Loader2 className="w-5 h-5 inline mr-2 animate-spin" />Analyzing...</> : <><Sparkles className="w-5 h-5 inline mr-2" />Verify</>}
        </button>
      </div>
      {verificationError && <p className="mt-4 text-amber-400 text-sm">⚠️ {verificationError}</p>}
    </div>
  );

  // IGETC Popup Component
  const IGETCArea = ({ area, info }) => {
    const isCompleted = info.completed;
    return (
      <div 
        onClick={() => setIgetcPopup({ area, info })}
        className={`p-3 rounded-lg text-center border cursor-pointer transition-all hover:scale-105 ${
          isCompleted 
            ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20' 
            : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
        }`}
      >
        <p className={`text-sm font-medium ${isCompleted ? 'text-emerald-400' : 'text-red-400'}`}>
          Area {area}
        </p>
        <p className="text-white/50 text-xs truncate">{info.name}</p>
        {isCompleted ? (
          <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto mt-1" />
        ) : (
          <Circle className="w-4 h-4 text-red-400 mx-auto mt-1" />
        )}
      </div>
    );
  };

  const IGETCPopup = ({ area, info, onClose }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="glass rounded-2xl p-6 max-w-md w-full animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">IGETC Area {area}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <p className="text-ucsc-gold font-medium mb-4">{info.name}</p>
        
        {info.completed ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Completed!</span>
            </div>
            <p className="text-white/80 text-sm">
              <span className="text-white/50">Satisfied by:</span>
            </p>
            <p className="text-emerald-300 font-mono mt-1">
              {info.satisfied_by || info.matched_course || "Course on transcript"}
            </p>
          </div>
        ) : (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-semibold">Not Yet Complete</span>
            </div>
            <p className="text-white/80 text-sm mb-2">
              <span className="text-white/50">Courses that satisfy this requirement:</span>
            </p>
            <div className="space-y-1">
              {(info.courses_needed || info.options || getIGETCCourses(area)).map((course, idx) => (
                <p key={idx} className="text-amber-300 font-mono text-sm">• {course}</p>
              ))}
            </div>
          </div>
        )}
        
        <button 
          onClick={onClose}
          className="btn-secondary w-full mt-4"
        >
          Close
        </button>
      </div>
    </div>
  );

  // Default IGETC courses if AI doesn't provide them
  const getIGETCCourses = (area) => {
    const courses = {
      "1A": ["EWRT 1A - English Composition", "ENGL 1A - English Composition"],
      "1B": ["EWRT 2 - Critical Reading & Writing", "ENGL 1B - Literature & Composition"],
      "1C": ["COMM 1 - Public Speaking", "SPCH 1 - Oral Communication"],
      "2": ["MATH 1A - Calculus I", "MATH 10 - Statistics", "MATH 22 - Discrete Math"],
      "3A": ["ART 1 - Art History", "MUS 1 - Music Appreciation", "HUMN 1 - Humanities"],
      "3B": ["ART 2A - Renaissance Art", "PHIL 1 - Philosophy", "HIST 4A - Western Civ"],
      "4": ["HIST 17A - US History", "POLI 1 - American Government", "ECON 1 - Microeconomics"],
      "5A": ["PHYS 4A - Physics", "CHEM 1A - Chemistry", "BIOL 6A - Biology"],
      "5B": ["BIOL 6B - Biology II", "CHEM 1B - Chemistry II", "PHYS 4B - Physics II"],
      "5C": ["CHEM 1A+1B Lab", "PHYS 4A+4B Lab", "BIOL 6A+6B Lab"],
      "6": ["SPAN 1 - Spanish", "FREN 1 - French", "ASL 1 - Sign Language", "CHIN 1 - Chinese"],
    };
    return courses[area] || ["See counselor for options"];
  };

  const renderResults = () => {
    if (!verificationResults) return null;
    const { eligibility_status, summary, major_requirements, risks, igetc_status, notes } = verificationResults;
    const status = {
      likely_eligible: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', title: 'Likely Eligible' },
      conditional: { color: 'text-amber-400', bg: 'bg-amber-500/20', title: 'Conditional' },
      not_yet_eligible: { color: 'text-red-400', bg: 'bg-red-500/20', title: 'Not Yet Eligible' }
    }[eligibility_status] || { color: 'text-amber-400', bg: 'bg-amber-500/20', title: 'Conditional' };

    // Calculate IGETC completion
    const igetcAreas = igetc_status && Object.keys(igetc_status).length > 0 
      ? igetc_status 
      : {
          "1A": { name: "English Composition", completed: false },
          "1B": { name: "Critical Thinking", completed: false },
          "1C": { name: "Oral Communication", completed: false },
          "2": { name: "Mathematical Concepts", completed: false },
          "3A": { name: "Arts", completed: false },
          "3B": { name: "Humanities", completed: false },
          "4": { name: "Social & Behavioral Sciences", completed: false },
          "5A": { name: "Physical Science", completed: false },
          "5B": { name: "Biological Science", completed: false },
          "5C": { name: "Lab Science", completed: false },
          "6": { name: "Language Other Than English", completed: false },
        };
    
    const igetcCompleted = Object.values(igetcAreas).filter(a => a.completed).length;
    const igetcTotal = Object.keys(igetcAreas).length;

    return (
      <div className="space-y-6">
        {/* IGETC Popup */}
        {igetcPopup && (
          <IGETCPopup 
            area={igetcPopup.area} 
            info={igetcPopup.info} 
            onClose={() => setIgetcPopup(null)} 
          />
        )}

        {/* Status Banner */}
        <div className={`${status.bg} rounded-2xl p-6`}>
          <h2 className={`text-2xl font-bold ${status.color}`}>{status.title}</h2>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-white/50 text-sm">GPA</p>
            <p className="text-2xl font-bold text-white">{summary.gpa}</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-white/50 text-sm">Units</p>
            <p className="text-2xl font-bold text-white">{summary.total_units}</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-white/50 text-sm">Major Prep</p>
            <p className="text-2xl font-bold text-white">
              {major_requirements.completed?.length || 0}/{(major_requirements.completed?.length || 0) + (major_requirements.missing?.length || 0)}
            </p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <p className="text-white/50 text-sm">IGETC</p>
            <p className="text-2xl font-bold text-white">{igetcCompleted}/{igetcTotal}</p>
          </div>
        </div>

        {/* Risks/Issues */}
        {risks?.length > 0 && (
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Issues to Address
            </h3>
            {risks.map((r, i) => (
              <div key={i} className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-2">
                <p className="text-amber-300 font-medium">{r.type}</p>
                <p className="text-white/70 text-sm">{r.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Major Requirements */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Major Preparation Requirements</h3>
          {major_requirements.completed?.length > 0 && (
            <div className="mb-4">
              <p className="text-emerald-400 text-sm mb-2">✓ Completed</p>
              {major_requirements.completed.map((r, i) => (
                <div key={i} className="p-2 bg-emerald-500/10 rounded-lg mb-1 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-white/80">{r.name}</span>
                  {r.matched_course && (
                    <span className="text-emerald-300 text-sm ml-auto">← {r.matched_course}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {major_requirements.missing?.length > 0 && (
            <div>
              <p className="text-red-400 text-sm mb-2">✗ Missing</p>
              {major_requirements.missing.map((r, i) => (
                <div key={i} className="p-2 bg-red-500/10 rounded-lg mb-1">
                  <div className="flex items-center gap-2">
                    <Circle className="w-4 h-4 text-red-400" />
                    <span className="text-white/80">{r.name}</span>
                  </div>
                  <p className="text-white/40 text-xs ml-6">Take: {r.codes?.join(' or ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* IGETC Section */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-ucsc-gold" />
            IGETC Progress
          </h3>
          <p className="text-white/50 text-sm mb-4">Click on any area to see details</p>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(igetcAreas).map(([area, info]) => (
              <IGETCArea key={area} area={area} info={info} />
            ))}
          </div>
          <div className="mt-4 p-3 bg-white/5 rounded-lg">
            <p className="text-white/60 text-sm">
              <span className="text-ucsc-gold font-semibold">{igetcCompleted}</span> of {igetcTotal} areas completed
              {igetcCompleted === igetcTotal && (
                <span className="text-emerald-400 ml-2">✓ IGETC Ready!</span>
              )}
            </p>
          </div>
        </div>

        {/* Notes */}
        {notes?.length > 0 && (
          <div className="glass-dark rounded-xl p-6">
            <h3 className="text-white/70 font-semibold mb-3">Notes</h3>
            <ul className="space-y-1">
              {notes.map((n, i) => (
                <li key={i} className="text-white/60 text-sm flex items-start gap-2">
                  <span className="text-ucsc-gold">•</span>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Disclaimer */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-amber-300/80 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span><strong>Disclaimer:</strong> This is an AI-powered estimate. Always verify with an academic counselor.</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button onClick={() => { setVerificationResults(null); setCurrentStep(2); }} className="btn-secondary">Edit Transcript</button>
          <button onClick={() => window.print()} className="btn-primary">Save Results</button>
        </div>
      </div>
    );
  };

  const renderRightPanel = () => {
    if (!isAuthenticated) return renderWelcomeScreen();
    if (isEditingProfile) return (
      <div>
        <h2 className="text-3xl font-bold text-white mb-6">Edit Profile</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-md">
          <input type="text" value={user.name || ''} onChange={(e) => setUser({ ...user, name: e.target.value })} placeholder="Name" className="input-field" required />
          <select value={user.communityCollege || ''} onChange={(e) => updateProfileField('communityCollege', e.target.value)} className="input-field" required><option value="">College</option>{COMMUNITY_COLLEGES.map(c => <option key={c}>{c}</option>)}</select>
          <select value={user.major || ''} onChange={(e) => updateProfileField('major', e.target.value)} className="input-field" required><option value="">Major</option>{getAvailableMajors().map(m => <option key={m}>{m}</option>)}</select>
          <div className="flex gap-4"><button type="button" onClick={() => setIsEditingProfile(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Save</button></div>
        </form>
      </div>
    );
    if (currentStep === 1) return renderUCSelection();
    if (currentStep === 2) return renderTranscriptEntry();
    if (currentStep === 3) return renderResults();
    return renderWelcomeScreen();
  };

  const renderPage = () => {
    if (currentPage === 'about') return <div className="glass rounded-2xl p-8"><h2 className="text-3xl font-bold text-white mb-6">About</h2><p className="text-white/70">TransferMap helps community college students verify UC transfer eligibility using AI. Built at CruzHacks 2025.</p></div>;
    if (currentPage === 'faqs') return <div className="glass rounded-2xl p-8"><h2 className="text-3xl font-bold text-white mb-6">FAQs</h2><div className="space-y-4">{[{q:"What format?",a:"PDF (text-based, not scanned)"},{q:"Is this official?",a:"No, verify with a counselor"}].map((f,i) => <div key={i} className="glass p-4 rounded-xl"><p className="text-ucsc-gold font-medium">{f.q}</p><p className="text-white/70">{f.a}</p></div>)}</div></div>;
    if (currentPage === 'info') return <div className="glass rounded-2xl p-8"><h2 className="text-3xl font-bold text-white mb-6">Resources</h2><a href="https://assist.org" target="_blank" className="block p-4 bg-white/5 rounded-lg text-white hover:bg-white/10">ASSIST.org →</a></div>;
    if (currentPage === 'dashboard') return <div className="glass rounded-2xl p-8"><Dashboard verificationResults={verificationResults} user={user} /></div>;
    return <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-12rem)]"><div className="lg:w-80">{renderLeftPanel()}</div><div className="flex-1 glass rounded-2xl p-8">{renderRightPanel()}</div></div>;
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 gradient-bg opacity-50" />
      <div className="relative z-10 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {renderNavBar()}
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

export default App;
