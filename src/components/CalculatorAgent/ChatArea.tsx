import React, { useState } from 'react';
import { FaArrowRight, FaArrowLeft, FaWandMagicSparkles, FaCheck } from 'react-icons/fa6';
import { FiLayout } from 'react-icons/fi';
import { US_STATES } from '@/components/Form/usStates';

interface Question {
  id: string;
  label: string;
  description?: string;
  type: 'textarea' | 'dropdown' | 'location';
  options?: string[];
  placeholder?: string;
}

const QUESTIONS: Question[] = [
  {
    id: 'q_industry',
    label: 'What is your primary industry?',
    description: 'What type of business are you operating?',
    type: 'dropdown',
    options: ['Home Services (Roofing, Plumbing, HVAC)', 'Professional Services (Law, Finance)', 'Retail / E-commerce', 'Restaurant / Hospitality', 'Real Estate', 'Other']
  },
  {
    id: 'q2',
    label: 'Where in the US is your business located?',
    description: 'We currently only serve businesses in the United States.',
    type: 'location'
  },
  {
    id: 'q3',
    label: 'Do you need E-commerce?',
    description: 'Will you be selling physical or digital products directly on the site?',
    type: 'dropdown',
    options: ['No', 'Yes, physical products', 'Yes, digital products/services']
  },
  {
    id: 'q4',
    label: 'How large is this project?',
    description: 'Roughly how many unique pages will we need to design?',
    type: 'dropdown',
    options: ['1-5 pages (Basic)', '6-15 pages (Standard)', '15+ pages (Complex)']
  },
  {
    id: 'q5',
    label: 'Content Management (CMS)',
    description: 'Will you need a backend to edit the website content yourself?',
    type: 'dropdown',
    options: ['Yes', 'No, Griffin\'s can handle updates']
  },
  {
    id: 'q6',
    label: 'User Accounts',
    description: 'Will visitors need to log in or create accounts?',
    type: 'dropdown',
    options: ['No', 'Yes, basic accounts', 'Yes, complex user roles']
  },
  {
    id: 'q7',
    label: 'SEO Requirements',
    description: 'How aggressive is your search engine optimization strategy?',
    type: 'dropdown',
    options: ['Basic Setup', 'Advanced Setup', 'Advanced + Ongoing Monthly SEO']
  },
  {
    id: 'q8',
    label: 'Copywriting',
    description: 'Who will be writing the text for the website?',
    type: 'dropdown',
    options: ['I have all the text ready', 'I need professional copywriting help']
  },
  {
    id: 'q9',
    label: 'Branding & Assets',
    description: 'Do you already have a logo and brand color palette?',
    type: 'dropdown',
    options: ['Yes, fully branded', 'I need a new logo/branding designed']
  },
  {
    id: 'q10',
    label: 'Animations & Interactions',
    description: 'How dynamic should the website feel?',
    type: 'dropdown',
    options: ['High-end custom animations', 'Smooth basic transitions', 'Static/No animations']
  },
  {
    id: 'q11',
    label: 'Timeline',
    description: 'When do you need this website launched?',
    type: 'dropdown',
    options: ['Standard (4-6 weeks)', 'Rush (2-3 weeks)', 'ASAP (Next 7 days)']
  },
  {
    id: 'q1',
    label: 'Tell us about your business.',
    description: 'What do you do, and what is the primary goal of your new website?',
    type: 'textarea',
    placeholder: 'E.g., We are a local landscaping company looking to get more quote requests online...'
  }
];

interface ChatAreaProps {
  onGenerate: (answers: Record<string, string>, email: string) => void;
  step: number;
  setStep: (step: number) => void;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ onGenerate, step, setStep, answers, setAnswers }) => {
  const [currentTextValue, setCurrentTextValue] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');

  const currentQ = step >= 0 && step < QUESTIONS.length ? QUESTIONS[step] : null;

  const handleGenerateClick = () => {
    if (!emailInput || !emailInput.includes('@')) {
      setEmailError('Please enter a valid email address to receive your analysis.');
      return;
    }
    setEmailError('');
    onGenerate(answers, emailInput);
  };


  const handleNext = () => {
    if (step === -1) {
      setStep(0);
      return;
    }
    
    if (currentQ?.type === 'textarea') {
      if (!currentTextValue.trim()) return;
      setAnswers(prev => ({ ...prev, [currentQ.id]: currentTextValue }));
    }

    if (currentQ?.type === 'location') {
      if (!city.trim() || !stateCode) return;
      // Stored as "City, ST" — the shape the payload mapper already expects.
      setAnswers(prev => ({ ...prev, [currentQ.id]: `${city.trim()}, ${stateCode}` }));
    }

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      // Finished all questions
      setStep(QUESTIONS.length);
    }
  };

  const handleBack = () => {
    if (step <= 0) return;
    const prevStep = step - 1;
    const prevQ = QUESTIONS[prevStep];
    // Restore any previously typed text so going back doesn't discard the answer.
    setCurrentTextValue(prevQ?.type === 'textarea' ? answers[prevQ.id] ?? '' : '');
    if (prevQ?.type === 'location') {
      const [savedCity = '', savedState = ''] = (answers[prevQ.id] ?? '')
        .split(',')
        .map(part => part.trim());
      setCity(savedCity);
      setStateCode(savedState);
    }
    setStep(prevStep);
  };

  const handleDropdownSelect = (val: string) => {
    if (!currentQ) return;
    const newAnswers = { ...answers, [currentQ.id]: val };
    setAnswers(newAnswers);
    
    // Auto advance on dropdown selection for better UX
    setTimeout(() => {
      if (step < QUESTIONS.length - 1) {
        setStep(step + 1);
      } else {
        setStep(QUESTIONS.length);
      }
    }, 300); // slight delay to show selection
  };

  const progress = step >= 0 ? ((step) / QUESTIONS.length) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col w-full h-full relative">
      
      {/* Progress bar at top if started */}
      {step >= 0 && step < QUESTIONS.length && (
        <div className="absolute top-0 left-0 w-full h-[3px] bg-white/5 z-50">
          <div 
            className="h-full bg-gradient-to-r from-transparent via-white/50 to-white shadow-[2px_0_10px_rgba(255,255,255,0.8)] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center items-center max-w-4xl mx-auto w-full p-6 md:p-12 overflow-y-auto">
        
        {/* Initial Hook State */}
        {step === -1 && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700 text-center">
            <h1 className="text-4xl md:text-5xl font-header font-extrabold tracking-tight text-[var(--color-heading)] mb-6 leading-tight">
              What can <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]">GWS AI</span> help you with?
            </h1>
            <p className="text-[var(--color-muted)] text-lg mb-12 max-w-2xl mx-auto">
              Answer a few quick questions and our AI will instantly calculate an estimated cost and generate a custom structural wireframe for your business.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-12">
              <div onClick={() => setStep(0)} className="group cursor-pointer bg-[var(--color-bg2)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-lg hover:shadow-[var(--color-primary)]/10">
                <h3 className="font-semibold text-[var(--color-heading)] mb-2 flex items-center gap-2">
                  <FaWandMagicSparkles className="text-[var(--color-primary)]" /> Estimate Project Cost
                </h3>
                <p className="text-sm text-[var(--color-muted)]">Get a real-time price calculation based on our knowledge base.</p>
              </div>
              <div onClick={() => setStep(0)} className="group cursor-pointer bg-[var(--color-bg2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-lg hover:shadow-[var(--color-accent)]/10">
                <h3 className="font-semibold text-[var(--color-heading)] mb-2 flex items-center gap-2">
                  <FiLayout className="text-[var(--color-accent)]" /> Generate Wireframes
                </h3>
                <p className="text-sm text-[var(--color-muted)]">Instantly visualize your website's structure before we talk.</p>
              </div>
            </div>

            <button 
              onClick={handleNext}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white font-bold text-lg hover:scale-105 transition-all shadow-lg shadow-[var(--color-primary)]/20"
            >
              Start Analysis <FaArrowRight />
            </button>
          </div>
        )}

        {/* Question State */}
        {step >= 0 && step < QUESTIONS.length && currentQ && (
          <div key={currentQ.id} className="w-full max-w-2xl animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="mb-2 flex items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-heading)] transition-colors cursor-pointer"
                >
                  <FaArrowLeft className="text-xs" /> Back
                </button>
              )}
              <span className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wider">
                Question {step + 1} of {QUESTIONS.length}
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-header font-bold text-[var(--color-heading)] mb-3 leading-tight">
              {currentQ.label}
            </h2>
            {currentQ.description && (
              <p className="text-[var(--color-muted)] text-lg mb-8">{currentQ.description}</p>
            )}

            {currentQ.type === 'location' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_15rem] gap-4">
                  <div>
                    <label
                      htmlFor="calc-city"
                      className="block mb-2 text-sm font-medium text-[var(--color-muted)]"
                    >
                      City
                    </label>
                    <input
                      id="calc-city"
                      autoFocus
                      type="text"
                      autoComplete="address-level2"
                      className="w-full bg-[var(--color-bg2)] border-2 border-[var(--color-border)] focus:border-[var(--color-primary)] rounded-2xl px-6 py-4 text-lg text-[var(--color-heading)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 transition-all shadow-sm"
                      placeholder="Freehold"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleNext();
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="calc-state"
                      className="block mb-2 text-sm font-medium text-[var(--color-muted)]"
                    >
                      State
                    </label>
                    <select
                      id="calc-state"
                      autoComplete="address-level1"
                      value={stateCode}
                      onChange={(e) => setStateCode(e.target.value)}
                      className={`w-full bg-[var(--color-bg2)] border-2 border-[var(--color-border)] focus:border-[var(--color-primary)] rounded-2xl px-6 py-4 text-lg focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 transition-all shadow-sm cursor-pointer ${
                        stateCode ? 'text-[var(--color-heading)]' : 'text-[var(--color-muted)]'
                      }`}
                    >
                      <option value="">Select…</option>
                      {US_STATES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.value} — {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleNext}
                  disabled={!city.trim() || !stateCode}
                  className="w-full flex justify-center items-center gap-2 py-4 rounded-xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white hover:scale-[1.02] shadow-lg shadow-[var(--color-primary)]/20"
                >
                  Continue <FaArrowRight />
                </button>
              </div>
            ) : currentQ.type === 'textarea' ? (
              <div className="space-y-6">
                <textarea
                  autoFocus
                  className="w-full bg-[var(--color-bg2)] border-2 border-[var(--color-border)] focus:border-[var(--color-primary)] rounded-2xl p-6 text-lg text-[var(--color-heading)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 transition-all min-h-[160px] resize-none shadow-sm"
                  placeholder={currentQ.placeholder}
                  value={currentTextValue}
                  onChange={(e) => setCurrentTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleNext();
                    }
                  }}
                />
                <button
                  onClick={handleNext}
                  disabled={!currentTextValue.trim()}
                  className="w-full flex justify-center items-center gap-2 py-4 rounded-xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white hover:scale-[1.02] shadow-lg shadow-[var(--color-primary)]/20"
                >
                  Continue <FaArrowRight />
                </button>
                <p className="text-center text-xs text-[var(--color-muted)]">Press Enter ↵ to continue</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQ.options?.map(opt => {
                  const isSelected = answers[currentQ.id] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleDropdownSelect(opt)}
                      className={`
                        text-left p-5 rounded-xl border-2 transition-all duration-200 font-semibold text-lg flex items-center justify-between
                        ${isSelected 
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] scale-[1.02] shadow-md shadow-[var(--color-primary)]/10' 
                          : 'border-[var(--color-border)] bg-[var(--color-bg2)] text-[var(--color-heading)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-bg2)]/80'}
                      `}
                    >
                      {opt}
                      {isSelected && <FaCheck className="text-[var(--color-primary)]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Final Generation State */}
        {step === QUESTIONS.length && (
          <div className="w-full text-center animate-in zoom-in-95 duration-700">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-accent)]/20 flex items-center justify-center mb-6 border border-[var(--color-primary)]/30">
              <FaCheck className="text-3xl text-[var(--color-primary)]" />
            </div>
            <h2 className="text-4xl md:text-5xl font-header font-bold text-[var(--color-heading)] mb-4">
              You're all set!
            </h2>
            <p className="text-lg text-[var(--color-muted)] mb-8 max-w-xl mx-auto">
              Enter your email below to connect to our AI Knowledge Base and generate your bespoke estimate & interactive wireframes.
            </p>

            <div className="max-w-md mx-auto mb-6">
              <input
                type="email"
                placeholder="your.name@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerateClick();
                }}
                className="w-full bg-[var(--color-bg2)] border-2 border-[var(--color-border)] focus:border-[var(--color-primary)] rounded-xl px-5 py-4 text-center text-lg text-[var(--color-heading)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 transition-all shadow-sm mb-2"
              />
              {emailError && (
                <p className="text-red-400 text-sm font-medium mt-1">{emailError}</p>
              )}
            </div>

            <button
              onClick={handleGenerateClick}
              className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white font-bold text-xl hover:scale-105 transition-all shadow-xl shadow-[var(--color-primary)]/30 cursor-pointer"
            >
              <FaWandMagicSparkles /> Generate My Results
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
