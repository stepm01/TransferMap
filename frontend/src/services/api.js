// API Service for communicating with the backend

const API_BASE = '/api';

// Helper function for API calls
async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'API request failed');
  }

  return response.json();
}

// User/Auth endpoints
export const registerUser = async (userData) => {
  return fetchAPI('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

export const getUser = async (email) => {
  return fetchAPI(`/auth/user/${encodeURIComponent(email)}`);
};

export const updateUser = async (email, userData) => {
  return fetchAPI(`/auth/user/${encodeURIComponent(email)}`, {
    method: 'PUT',
    body: JSON.stringify(userData),
  });
};

// Reference data endpoints
export const getCommunityColleges = async () => {
  return fetchAPI('/colleges');
};

export const getSupportedMajors = async () => {
  return fetchAPI('/majors');
};

export const getUCCampuses = async () => {
  return fetchAPI('/uc-campuses');
};

// UC Selection endpoint
export const selectTargetUC = async (userEmail, targetUC, targetMajor) => {
  return fetchAPI('/select-uc', {
    method: 'POST',
    body: JSON.stringify({
      user_email: userEmail,
      target_uc: targetUC,
      target_major: targetMajor,
    }),
  });
};

// Transcript endpoints
export const uploadTranscript = async (userEmail, courses) => {
  return fetchAPI('/transcript/upload', {
    method: 'POST',
    body: JSON.stringify({
      user_email: userEmail,
      courses: courses,
    }),
  });
};

export const getTranscript = async (email) => {
  return fetchAPI(`/transcript/${encodeURIComponent(email)}`);
};

// Verification endpoint
export const verifyEligibility = async (email) => {
  return fetchAPI(`/verify/${encodeURIComponent(email)}`, {
    method: 'POST',
  });
};

export const getVerificationResults = async (email) => {
  return fetchAPI(`/results/${encodeURIComponent(email)}`);
};

// Demo mode - mock API responses when backend isn't available
const DEMO_MODE = true;

const mockData = {
  colleges: [
    "De Anza College",
    "Foothill College",
    "Mission College",
    "West Valley College",
    "Ohlone College",
    "San Jose City College",
    "Evergreen Valley College",
  ],
  majors: ["Computer Science", "Biology", "Psychology"],
  campuses: [
    { id: "ucsc", name: "UC Santa Cruz", available: true },
    { id: "ucb", name: "UC Berkeley", available: false },
    { id: "ucla", name: "UCLA", available: false },
    { id: "ucsd", name: "UC San Diego", available: false },
    { id: "ucd", name: "UC Davis", available: false },
    { id: "uci", name: "UC Irvine", available: false },
    { id: "ucr", name: "UC Riverside", available: false },
    { id: "ucsb", name: "UC Santa Barbara", available: false },
    { id: "ucm", name: "UC Merced", available: false },
  ],
};

// Export demo-aware versions
export const api = {
  getCommunityColleges: async () => {
    if (DEMO_MODE) return { colleges: mockData.colleges };
    return getCommunityColleges();
  },

  getSupportedMajors: async () => {
    if (DEMO_MODE) return { majors: mockData.majors };
    return getSupportedMajors();
  },

  getUCCampuses: async () => {
    if (DEMO_MODE) return { campuses: mockData.campuses };
    return getUCCampuses();
  },

  registerUser,
  getUser,
  updateUser,
  selectTargetUC,
  uploadTranscript,
  getTranscript,
  verifyEligibility,
  getVerificationResults,
};

export default api;
