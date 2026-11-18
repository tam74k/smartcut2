import React, { useState, useEffect, useMemo } from 'react';
import {
  Scissors,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Phone,
  MessageCircle,
  ShieldCheck,
  Users,
  Calendar,
  Layers,
  Monitor,
  Smartphone,
  Tablet,
  Star,
  ArrowRight,
  LogIn,
  Menu,
  X,
  Zap,
  BarChart3,
  Package,
  Receipt,
  Store,
  Headphones
} from 'lucide-react';
import { AppSettings } from '../types';
import { DB } from '../services/db';

interface LandingPageProps {
  onLoginClick: () => void;
  onStartTrialClick: () => void;
  settings?: AppSettings;
}

export function LandingPage({ onLoginClick, onStartTrialClick, settings }: LandingPageProps) {
  // Official Platform Logo from Database (Platform-wide logo)
  const [platformLogo, setPlatformLogo] = useState<string>(() => {
    try {
      return localStorage.getItem('smartcut_platform_logo_url') || 'https://api.101488.xyz/storage/v1/object/public/salon-logos/newlogo.jpeg';
    } catch {
      return 'https://api.101488.xyz/storage/v1/object/public/salon-logos/newlogo.jpeg';
    }
  });
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadPlatformBranding = async () => {
      try {
        const pSettings = await DB.fetchPlatformSettings();
        if (pSettings && isMounted) {
          const logo = pSettings.platformLogoUrl || pSettings.logoUrl;
          if (logo) {
            setPlatformLogo(logo);
            try {
              localStorage.setItem('smartcut_platform_logo_url', logo);
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Error loading platform logo:', err);
      }
    };
    loadPlatformBranding();
    return () => { isMounted = false; };
  }, []);

  // Mobile Nav Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hero Slider State (Continuous auto-switching between the 2 mockups)
  const slides = [
    {
      image: '/landing/hero1.jpg',
      badge: 'الصالونات النسائية ومراكز التجميل والميكب',
      tagline: 'تجربة حجز ونقاط بيع راقية تناسب عملائك المميزين'
    },
    {
      image: '/landing/hero2.jpg',
      badge: 'صالونات الحلاقة الرجالية ومراكز العناية الفاخرة',
      tagline: 'إدارة متكاملة لفرق العمل، الكراسي، والورديات بكل سهولة'
    }
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSliderPaused, setIsSliderPaused] = useState(false);

  // Auto-play slider every 4.5 seconds
  useEffect(() => {
    if (isSliderPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length, isSliderPaused]);

  // Pricing State: Monthly vs Annual (Annual offers 2 months free)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [currency, setCurrency] = useState<'EGP' | 'USD'>('EGP');

  // Partner / Client Salons for Horizontal Marquee Ticker (من قاعدة البيانات)
  const [partnerSalons, setPartnerSalons] = useState<{ id: string; name: string; logoUrl: string }[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadPartners = async () => {
      try {
        const list = await DB.fetchPartnerSalons();
        if (isMounted) {
          if (list && list.length > 0) {
            setPartnerSalons(list);
          } else {
            // Default sample partner salons until user populates database table
            setPartnerSalons([
              { id: '1', name: 'صالون لوميير بيوتي', logoUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=260&auto=format&fit=crop&q=80' },
              { id: '2', name: 'ذا باربر كلوب', logoUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=260&auto=format&fit=crop&q=80' },
              { id: '3', name: 'مركز رويال سبا', logoUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=260&auto=format&fit=crop&q=80' },
              { id: '4', name: 'إيليت صالون آند سبا', logoUrl: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=260&auto=format&fit=crop&q=80' },
              { id: '5', name: 'صالون برنسيس كير', logoUrl: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=260&auto=format&fit=crop&q=80' },
              { id: '6', name: 'جولد باربر شوب', logoUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=260&auto=format&fit=crop&q=80' },
              { id: '7', name: 'بيوتي لاونج سنتر', logoUrl: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=260&auto=format&fit=crop&q=80' }
            ]);
          }
        }
      } catch (err) {
        console.warn('Error loading partner salons:', err);
      }
    };
    loadPartners();
    return () => { isMounted = false; };
  }, []);

  // Infinite Marquee Cloned Items (ضمان استمرار دوران الشريط بانسيابية تامة)
  const marqueeLogos = useMemo(() => {
    if (partnerSalons.length === 0) return [];
    if (partnerSalons.length < 8) {
      return [...partnerSalons, ...partnerSalons, ...partnerSalons, ...partnerSalons];
    }
    return [...partnerSalons, ...partnerSalons];
  }, [partnerSalons]);

  // Contact Information
  const contactPhone = '+201014889704';
  const whatsappUrl = `https://wa.me/201014889704?text=${encodeURIComponent(
    'مرحباً، أود الاستفسار عن منظومة سمارت كت برو (Smart Cut Pro) وبدء التجربة المجانية.'
  )}`;

  // Smooth scroll helper
  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans selection:bg-emerald-500 selection:text-white" dir="rtl">
      {/* ========================================================
          1. HEADER / NAVBAR (Light Theme)
         ======================================================== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand (Official Platform Logo from Database) */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            {platformLogo && !logoLoadFailed ? (
              <div className="w-12 h-12 rounded-2xl bg-white p-1 border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={platformLogo}
                  alt="شعار سمارت كت برو"
                  className="w-full h-full object-contain rounded-xl"
                  onError={() => setLogoLoadFailed(true)}
                />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 ring-2 ring-emerald-500/20 shrink-0">
                <Scissors size={22} className="transform -rotate-12" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-slate-900 tracking-tight">سمارت كت برو</span>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200 hidden sm:inline-block">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">المنظومة السحابية الذكية للصالونات</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-sm font-bold text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              الرئيسية
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-sm font-bold text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              مزايا البرنامج
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-sm font-bold text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              الأسعار والباقات
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="text-sm font-bold text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              تواصل معنا
            </button>
          </nav>

          {/* Action Buttons (Desktop) */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              type="button"
              onClick={onLoginClick}
              className="h-10 px-4 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <LogIn size={15} />
              <span>تسجيل دخول</span>
            </button>

            <button
              type="button"
              onClick={onStartTrialClick}
              className="h-10 px-4 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer transform hover:-translate-y-0.5 whitespace-nowrap"
            >
              <Sparkles size={15} className="text-amber-300" />
              <span>إنشاء حساب تجريبي مجاني 7 أيام</span>
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-700 hover:text-slate-900 focus:outline-none"
            aria-label="قائمة الموقع"
          >
            {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top-2 duration-200">
            <button
              onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="block w-full text-right py-2 text-sm font-bold text-slate-700 hover:text-emerald-600 border-b border-slate-100"
            >
              الرئيسية
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-right py-2 text-sm font-bold text-slate-700 hover:text-emerald-600 border-b border-slate-100"
            >
              مزايا البرنامج
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="block w-full text-right py-2 text-sm font-bold text-slate-700 hover:text-emerald-600 border-b border-slate-100"
            >
              الأسعار والباقات
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="block w-full text-right py-2 text-sm font-bold text-slate-700 hover:text-emerald-600 border-b border-slate-100"
            >
              تواصل معنا
            </button>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); onStartTrialClick(); }}
                className="w-full py-3 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
              >
                <Sparkles size={16} className="text-amber-300" />
                <span>إنشاء حساب تجريبي مجاني 7 أيام</span>
              </button>
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); onLoginClick(); }}
                className="w-full py-2.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center gap-2"
              >
                <LogIn size={15} />
                <span>تسجيل دخول</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================
          2. HERO SECTION WITH CONTINUOUS SLIDER
         ======================================================== */}
      <section
        className="relative min-h-[92vh] lg:min-h-screen flex items-center justify-center pt-24 pb-20 overflow-hidden"
        onMouseEnter={() => setIsSliderPaused(true)}
        onMouseLeave={() => setIsSliderPaused(false)}
      >
        {/* Background Auto-Slider Images */}
        <div className="absolute inset-0 z-0">
          {slides.map((slide, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                idx === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
              } transition-transform duration-[6000ms]`}
            >
              <img
                src={slide.image}
                alt={`Smart Cut Pro Presentation ${idx + 1}`}
                className="w-full h-full object-cover object-center"
              />
            </div>
          ))}

          {/* Balanced Photography Scrim Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/65 to-slate-900/50 backdrop-blur-[1px]"></div>
          {/* Subtle bottom fade to seamlessly blend into white page below */}
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-white via-white/40 to-transparent"></div>
        </div>

        {/* Hero Slider Prev/Next Controls */}
        <button
          type="button"
          onClick={() => setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/30 hover:bg-white/80 text-white hover:text-slate-900 border border-white/30 backdrop-blur-md hidden md:flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-105"
          aria-label="الصورة السابقة"
        >
          <ChevronRight size={22} />
        </button>
        <button
          type="button"
          onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/30 hover:bg-white/80 text-white hover:text-slate-900 border border-white/30 backdrop-blur-md hidden md:flex items-center justify-center transition-all cursor-pointer shadow-lg hover:scale-105"
          aria-label="الصورة التالية"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Hero Content Overlay */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          {/* Official Logo Badge in Hero */}
          {platformLogo && !logoLoadFailed && (
            <div className="flex justify-center mb-1">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/95 p-2 shadow-2xl border-2 border-white/80 backdrop-blur-md flex items-center justify-center transform hover:scale-105 transition-all">
                <img
                  src={platformLogo}
                  alt="شعار سمارت كت برو الرسمي"
                  className="w-full h-full object-contain rounded-2xl"
                  onError={() => setLogoLoadFailed(true)}
                />
              </div>
            </div>
          )}

          {/* Active Slide Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 border border-white/40 text-white text-xs font-bold backdrop-blur-md shadow-md">
            <Sparkles size={14} className="text-amber-300" />
            <span>{slides[currentSlide].badge}</span>
          </div>

          {/* Main Title (White) */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-tight drop-shadow-lg">
            سمارت كت برو
          </h1>

          {/* Subtitle (White) */}
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-white/95 tracking-wide drop-shadow-md">
            النظام المتخصص لإدارة صالونات التجميل
          </h2>

          {/* Powerful Description / Value Offer */}
          <p className="max-w-3xl mx-auto text-base sm:text-lg text-slate-100 font-medium leading-relaxed drop-shadow-sm">
            المنظومة السحابية الذكية المتكاملة لنقاط البيع السريعة، تنظيم الحجوزات والمواعيد، 
            حساب عمولات ومسير رواتب الموظفين بدقة متناهية، وإدارة المخزون والورديات بكل سهولة واحترافية من أي جهاز.
          </p>

          {/* Two Prominent Action Buttons on Hero (Harmonious & Perfectly Sized) */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={onStartTrialClick}
              className="w-full sm:w-auto h-13 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-black text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-600 hover:to-teal-600 rounded-2xl shadow-2xl shadow-emerald-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-1 active:scale-95 whitespace-nowrap group shrink-0"
            >
              <Sparkles size={18} className="text-amber-300 group-hover:rotate-12 transition-transform shrink-0" />
              <span>إنشاء حساب تجريبي مجاني 7 أيام</span>
            </button>

            <button
              type="button"
              onClick={onLoginClick}
              className="w-full sm:w-auto h-13 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-black text-slate-900 bg-white hover:bg-slate-50 border border-white/80 rounded-2xl backdrop-blur-md transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xl hover:-translate-y-1 active:scale-95 whitespace-nowrap shrink-0"
            >
              <LogIn size={18} className="text-emerald-700 shrink-0" />
              <span>تسجيل الدخول</span>
            </button>
          </div>

          {/* Mini Trust Highlights */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-semibold text-white drop-shadow-xs">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>تفعيل فوري مجاني 7 أيام</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>بدون بطاقة ائتمانية</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>كمبيوتر • تابلت • جوال</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>دعم فني وتدريب مجاني</span>
            </span>
          </div>

          {/* Slider Dots Indicator */}
          <div className="pt-3 flex items-center justify-center gap-2.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={`h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === currentSlide ? 'w-8 bg-emerald-400 shadow-md shadow-emerald-400/50' : 'w-2.5 bg-white/40 hover:bg-white/80'
                }`}
                aria-label={`شريحة رقم ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          3. STATS & TRUST RIBBON (Light Card on White)
         ======================================================== */}
      <section className="relative z-20 -mt-10 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <p className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">+500</p>
            <p className="text-xs sm:text-sm font-bold text-slate-700">صالون ومركز تجميل</p>
          </div>
          <div className="space-y-1 border-r border-slate-100">
            <p className="text-3xl sm:text-4xl font-black text-teal-600 font-mono">+1,000,000</p>
            <p className="text-xs sm:text-sm font-bold text-slate-700">فاتورة وحجز منجز</p>
          </div>
          <div className="space-y-1 border-r-0 md:border-r border-slate-100">
            <p className="text-3xl sm:text-4xl font-black text-amber-600 font-mono">99.9%</p>
            <p className="text-xs sm:text-sm font-bold text-slate-700">استقرار سحابي وأمان</p>
          </div>
          <div className="space-y-1 border-r border-slate-100">
            <p className="text-3xl sm:text-4xl font-black text-sky-600 font-mono">24/7</p>
            <p className="text-xs sm:text-sm font-bold text-slate-700">دعم فني وتحديثات</p>
          </div>
        </div>
      </section>

      {/* ========================================================
          4. FEATURES SECTION (Light Theme - بدون إسهاب)
         ======================================================== */}
      <section id="features" className="py-24 bg-slate-50/70 border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
              <Zap size={14} />
              <span>مزايا النظام الأساسية</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
              كل ما يحتاجه صالونك في مكان واحد وبدون تعقيد
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
              صُمم سمارت كت برو بأحدث المعايير البرمجية ليمنحك تحكماً شاملاً وسريعاً في جميع تفاصيل الصالون التشغيلية والمالية.
            </p>
          </div>

          {/* 8 Feature Cards (White Cards with Crisp Light Accents) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="bg-white border border-slate-200/80 hover:border-emerald-500 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-5 group-hover:scale-110 transition-transform">
                <Receipt size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">نقاط بيع سريعة (POS)</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                إصدار فواتير وسندات بلمسة واحدة، دعم الدفع النقدي والشبكة والمختلط، وطباعة حرارية سريعة متوافقة مع كل الطابعات.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white border border-slate-200/80 hover:border-teal-500 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 mb-5 group-hover:scale-110 transition-transform">
                <Calendar size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">جدول حجوزات ومواعيد ذكي</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                تنظيم مواعيد العملاء والميكب آرتست، تتبع واستلام العربون، منع التضارب، وتنبيهات فورية للحضور والمواعيد.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white border border-slate-200/80 hover:border-amber-500 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-5 group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">عمولات الموظفين والرواتب</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                احتساب آلي دقيق لعمولات الخدمات والمنتجات، متابعة السلف والمكافآت والخصومات بضغطة زر وبدون أي أخطاء حسابية.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white border border-slate-200/80 hover:border-indigo-500 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-5 group-hover:scale-110 transition-transform">
                <Package size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">المخزون واستهلاك الخامات</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                خصم كميات الخامات ومستلزمات العناية تلقائياً مع كل خدمة، جرد سريع للمستودع، وتنبيهات ذكية عند نقص المخزون.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white border border-slate-200/80 hover:border-rose-500 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-5 group-hover:scale-110 transition-transform">
                <Layers size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">ضبط الخزائن والورديات</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                مطابقة عهدة الكاشير الصباحية والمسائية، تقفيل وردية إلكتروني آمن، ومنع التلاعب النقدي وحساب العجز والزيادة.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white border border-slate-200/80 hover:border-sky-500 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 mb-5 group-hover:scale-110 transition-transform">
                <Monitor size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">شاشات الانتظار وبوابات الخدمة</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                شاشة نداء مرئية وصوتية للعملاء، كيوسك حجز ذاتي، وبوابات مستقلة لخبيرات التجميل والموظفين لمتابعة أدائهم.
              </p>
            </div>

            {/* Feature 7 */}
            <div className="bg-white border border-slate-200/80 hover:border-purple-500 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 mb-5 group-hover:scale-110 transition-transform">
                <BarChart3 size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">تقارير الأرباح والتحليلات</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                لوحة تحكم تنفيذية توضح صافي أرباح الصالون، الإيرادات اليومية، مصروفات التشغيل، وأكثر الخدمات طلباً في لحظات.
              </p>
            </div>

            {/* Feature 8 */}
            <div className="bg-white border border-slate-200/80 hover:border-emerald-500 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-5 group-hover:scale-110 transition-transform">
                <Store size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">سحابي ومتعدد الفروع</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                تابع كافة فروع صالونك من شاشة واحدة أينما كنت، مع نظام صلاحيات أمان محكم لكل موظف ومدير فرع.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          5. CROSS-DEVICE SHOWCASE (White Background)
         ======================================================== */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-6 text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold">
                <Tablet size={14} />
                <span>توافق تام وعمل فوري</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
                يعمل بسلاسة على شاشات الكاشير، التابلت، والجوال
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                لا حاجة لشراء أجهزة باهظة الثمن! سمارت كت برو يعمل مباشرة عبر المتصفح أو كتطبيق على أجهزة الكمبيوتر، الشاشات اللمسية، أجهزة الآيباد والتابلت، وهواتف الأندرويد والآيفون.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Monitor size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">شاشات نقاط البيع والكاشير المكتبي</p>
                    <p className="text-xs text-slate-500">لإصدار الفواتير وطباعة الإيصالات والتحكم الكامل</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center shrink-0">
                    <Tablet size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">أجهزة التابلت والآيباد داخل الصالون</p>
                    <p className="text-xs text-slate-500">لشاشات الكيوسك الذاتي وجداول حجوزات الاستقبال</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">الهواتف الذكية للمالك والموظفين</p>
                    <p className="text-xs text-slate-500">لمتابعة الأرباح والتقارير الفورية لحظة بلحظة من أي مكان</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Showcase Visual Container */}
            <div className="lg:col-span-7">
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-2xl group">
                <img
                  src="/landing/hero1.jpg"
                  alt="Smart Cut Pro across devices"
                  className="w-full h-auto object-cover transform group-hover:scale-102 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"></div>
                <div className="absolute bottom-4 right-4 left-4 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">واجهة عربية أنيقة وسهلة التعلم</p>
                      <p className="text-[11px] text-slate-500">فريقك سيبدأ العمل في دقائق دون تعقيدات تدريب</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onStartTrialClick}
                    className="px-4 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all cursor-pointer shrink-0 shadow-md shadow-emerald-600/20"
                  >
                    جرب الآن
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          6. PRICING SECTION (Light Theme Cards)
         ======================================================== */}
      <section id="pricing" className="py-24 bg-slate-50/70 border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
              <Star size={14} />
              <span>خطط وأسعار شفافة</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900">
              باقات اشتراك تناسب حجم صالونك وطموحه
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
              اختر الباقة المناسبة لفريق عملك، وابدأ تجربتك المجانية لمدة 7 أيام كاملة الميزات بدون أي التزام مسبق.
            </p>

            {/* Currency & Period Switchers */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              {/* Billing Period Toggle */}
              <div className="bg-slate-200/80 border border-slate-300/80 p-1 rounded-2xl inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    billingPeriod === 'monthly' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  دفع شهري
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod('annual')}
                  className={`px-5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    billingPeriod === 'annual' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>دفع سنوي</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-black">
                    وفر شهرين
                  </span>
                </button>
              </div>

              {/* Currency Toggle */}
              <div className="bg-slate-200/80 border border-slate-300/80 p-1 rounded-2xl inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setCurrency('EGP')}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    currency === 'EGP' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  جنيه مصري (EGP)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    currency === 'USD' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  دولار أمريكي (USD)
                </button>
              </div>
            </div>
          </div>

          {/* 3 Subscription Plan Cards (Clean White Cards) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Plan 1: Starter */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between shadow-md hover:shadow-xl transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    1 إلى 5 موظفين
                  </span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">باقة البداية</h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  مثالية للصالونات الناشئة والصغيرة التي تبحث عن نظام فواتير وحجوزات سريع ومنظم.
                </p>

                {/* Price */}
                <div className="mb-6 pb-6 border-b border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900 font-mono">
                      {currency === 'EGP'
                        ? billingPeriod === 'monthly' ? '350' : '3,500'
                        : billingPeriod === 'monthly' ? '13' : '130'}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {currency === 'EGP' ? 'ج.م' : '$'} / {billingPeriod === 'monthly' ? 'شهرياً' : 'سنوياً'}
                    </span>
                  </div>
                  {billingPeriod === 'annual' && (
                    <p className="text-[11px] text-emerald-600 font-bold mt-1">توفير شهرين مجاناً عند السداد السنوي</p>
                  )}
                </div>

                {/* Features List */}
                <div className="space-y-3 text-xs text-slate-700 font-medium">
                  <p className="font-bold text-slate-900 text-xs mb-2">تشمل الميزات التالية:</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>فريق عمل حتى 5 موظفين</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>نقاط البيع السريعة وفواتير غير محدودة</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>جدول الحجوزات والمواعيد التفاعلي</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>إدارة الخدمات والأسعار وقائمة العناية</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>إدارة الخزينة والورديات اليومية</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>دعم فرع واحد وربط الأجهزة المحلية</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  type="button"
                  onClick={onStartTrialClick}
                  className="w-full py-3.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs transition-all border border-slate-200 cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <span>ابدأ تجربة 7 أيام مجاناً</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            {/* Plan 2: Growth (Popular) */}
            <div className="relative bg-white border-2 border-emerald-500 rounded-3xl p-8 flex flex-col justify-between shadow-2xl shadow-emerald-500/10 transform lg:-translate-y-3">
              {/* Popular Badge */}
              <div className="absolute -top-3.5 right-1/2 translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-black px-4 py-1 rounded-full shadow-md flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-200" />
                <span>الأكثر طلباً واختياراً</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4 pt-1">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    6 إلى 10 موظفين
                  </span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">باقة التوسع</h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  الخيار المثالي للصالونات النشطة التي تحتاج لحساب العمولات والمخازن وبرامج الولاء.
                </p>

                {/* Price */}
                <div className="mb-6 pb-6 border-b border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-emerald-600 font-mono">
                      {currency === 'EGP'
                        ? billingPeriod === 'monthly' ? '450' : '4,500'
                        : billingPeriod === 'monthly' ? '17' : '160'}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {currency === 'EGP' ? 'ج.م' : '$'} / {billingPeriod === 'monthly' ? 'شهرياً' : 'سنوياً'}
                    </span>
                  </div>
                  {billingPeriod === 'annual' && (
                    <p className="text-[11px] text-emerald-600 font-bold mt-1">وفر شهرين مجاناً عند الاشتراك السنوي</p>
                  )}
                </div>

                {/* Features List */}
                <div className="space-y-3 text-xs text-slate-800 font-medium">
                  <p className="font-bold text-slate-900 text-xs mb-2">كافة ميزات باقة البداية، بالإضافة إلى:</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>فريق عمل من 6 إلى 10 موظفين</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>إدارة المخازن والمستودع وحركة استهلاك الخامات</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>حساب عمولات الموظفين والسلف والمسير الذكي</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>برنامج ولاء ونقاط العملاء وكوبونات الخصم</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>إشعارات تذكير المواعيد وربط رسائل واتساب</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>تقارير مالية تفصيلية ومقارنات دورية</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  type="button"
                  onClick={onStartTrialClick}
                  className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs transition-all shadow-xl shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:scale-95"
                >
                  <Sparkles size={16} className="text-amber-200" />
                  <span>ابدأ تجربة 7 أيام مجاناً</span>
                </button>
              </div>
            </div>

            {/* Plan 3: Enterprise */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between shadow-md hover:shadow-xl transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    أكثر من 10 موظفين
                  </span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">باقة الأعمال الكبرى</h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  الحل الشامل واللامحدود للمراكز الكبرى والمنشآت المتعددة الفروع مع كامل الصلاحيات.
                </p>

                {/* Price */}
                <div className="mb-6 pb-6 border-b border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900 font-mono">
                      {currency === 'EGP'
                        ? billingPeriod === 'monthly' ? '550' : '5,500'
                        : billingPeriod === 'monthly' ? '27' : '264'}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {currency === 'EGP' ? 'ج.م' : '$'} / {billingPeriod === 'monthly' ? 'شهرياً' : 'سنوياً'}
                    </span>
                  </div>
                  {billingPeriod === 'annual' && (
                    <p className="text-[11px] text-emerald-600 font-bold mt-1">توفير شهرين مجاناً عند السداد السنوي</p>
                  )}
                </div>

                {/* Features List */}
                <div className="space-y-3 text-xs text-slate-700 font-medium">
                  <p className="font-bold text-slate-900 text-xs mb-2">كافة ميزات باقة التوسع، بالإضافة إلى:</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>عدد موظفين غير محدود (11+ موظف)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>دعم كامل للفروع المتعددة والمزامنة المركزية</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>شاشة نداء العملاء بالصوت (Queue Calling)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>شاشات كيوسك الخدمة الذاتية للعملاء</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>بوابة خاصة للموظفين لمتابعة مستحقاتهم</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>أولوية قصوى وتدريب مخصص في الدعم الفني</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  type="button"
                  onClick={onStartTrialClick}
                  className="w-full py-3.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs transition-all border border-slate-200 cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <span>ابدأ تجربة 7 أيام مجاناً</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Note on Additional Branches */}
          <div className="mt-12 text-center">
            <p className="text-xs text-slate-500 font-medium">
              هل تمتلك فروعاً إضافية؟ يتم ترخيص كل فرع إضافي بتكلفة مخفضة (تبدأ من 250 ج.م شهرياً) مع ربط موحد لكافة التقارير.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          6B. PARTNER SALONS HORIZONTAL MARQUEE (شريط الصالونات المتحرك أسفل الباقات)
         ======================================================== */}
      {marqueeLogos.length > 0 && (
        <section className="py-16 bg-white border-t border-b border-slate-200/80 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
              <Sparkles size={13} className="text-amber-500" />
              <span>شركاء النجاح • صالونات ومراكز تثق بنا</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
              صالونات ومراكز تجميل تعتمد على سمارت كت برو
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl mx-auto">
              نعتز بثقة نخبة من أرقى صالونات الحلاقة الرجالية، ومراكز التجميل والميكب آرتست، والسبا في إدارة أعمالهم اليومية
            </p>
          </div>

          {/* Marquee Ticker Track with Left/Right Gradient Masks */}
          <div className="relative w-full overflow-hidden py-3 select-none">
            {/* Gradient Mask (Right Edge - In RTL) */}
            <div className="pointer-events-none absolute right-0 inset-y-0 w-24 sm:w-44 bg-gradient-to-l from-white via-white/80 to-transparent z-10"></div>
            {/* Gradient Mask (Left Edge - In RTL) */}
            <div className="pointer-events-none absolute left-0 inset-y-0 w-24 sm:w-44 bg-gradient-to-r from-white via-white/80 to-transparent z-10"></div>

            {/* Continuous Scrolling Row */}
            <div className="animate-marquee-rtl flex items-center gap-5 sm:gap-6">
              {marqueeLogos.map((salon, idx) => (
                <div
                  key={`${salon.id}-${idx}`}
                  title={salon.name}
                  className="w-44 h-24 sm:w-48 sm:h-24 bg-white border border-slate-200/90 hover:border-emerald-500 rounded-2xl p-3 shadow-2xs hover:shadow-lg transition-all duration-300 flex flex-col items-center justify-center shrink-0 group cursor-pointer"
                >
                  <div className="w-full h-14 flex items-center justify-center overflow-hidden">
                    <img
                      src={salon.logoUrl}
                      alt={salon.name}
                      loading="lazy"
                      className="max-h-12 max-w-[130px] w-auto h-auto object-contain transition-all duration-300 filter grayscale contrast-115 group-hover:grayscale-0 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 group-hover:text-emerald-700 transition-colors truncate max-w-[140px] text-center mt-1">
                    {salon.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================
          7. BOTTOM CTA SECTION (Light Emerald Gradient Banner)
         ======================================================== */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-y border-emerald-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold">
            <Sparkles size={14} className="text-amber-500" />
            <span>ابدأ الآن خلال دقيقة واحدة</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
            جاهز لنقل صالونك إلى مستوى جديد من التميز والأرباح؟
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
            انضم إلى المئات من أصحاب الصالونات الناجحة واستفد من فترة التجربة المجانية الكاملة لـ 7 أيام واكتشف الفرق بنفسك.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-2xl mx-auto">
            <button
              type="button"
              onClick={onStartTrialClick}
              className="w-full sm:w-auto h-13 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-2xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-1 active:scale-95 whitespace-nowrap shrink-0"
            >
              <Sparkles size={18} className="text-amber-300 shrink-0" />
              <span>إنشاء حساب تجريبي مجاني 7 أيام</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto h-13 sm:h-14 px-6 sm:px-8 text-sm sm:text-base font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:-translate-y-1 active:scale-95 whitespace-nowrap shrink-0"
            >
              <MessageCircle size={18} className="text-emerald-600 shrink-0" />
              <span>محادثة واتساب مباشرة</span>
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================
          8. FOOTER (Light Theme مع رقم الاتصال +201014889704)
         ======================================================== */}
      <footer id="contact" className="bg-white border-t border-slate-200 pt-16 pb-12 text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-100">
            {/* Col 1 & 2: Brand Info */}
            <div className="lg:col-span-2 space-y-4 text-right">
              <div className="flex items-center gap-3">
                {platformLogo && !logoLoadFailed ? (
                  <div className="w-12 h-12 rounded-2xl bg-white p-1 border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                    <img
                      src={platformLogo}
                      alt="شعار سمارت كت برو"
                      className="w-full h-full object-contain rounded-xl"
                      onError={() => setLogoLoadFailed(true)}
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
                    <Scissors size={20} className="transform -rotate-12" />
                  </div>
                )}
                <span className="text-xl font-black text-slate-900">سمارت كت برو</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm font-medium">
                منظومة سحابية متخصصة ومصممة بأعلى معايير الدقة لخدمة صالونات الحلاقة، مراكز التجميل، مشاغل الخياطة النسائية، والمراكز الصحية (السبا).
              </p>
              <div className="pt-2 flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>بيانات مشفرة وسيرفرات سحابية آمنة</span>
                </div>
              </div>
            </div>

            {/* Col 3: Quick Navigation */}
            <div className="space-y-3">
              <h4 className="text-sm font-black text-slate-900">روابط سريعة</h4>
              <ul className="space-y-2 text-xs font-medium">
                <li>
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    الرئيسية
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('features')}
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    مزايا البرنامج
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('pricing')}
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    الأسعار وباقات الاشتراك
                  </button>
                </li>
                <li>
                  <button
                    onClick={onLoginClick}
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    تسجيل الدخول
                  </button>
                </li>
                <li>
                  <button
                    onClick={onStartTrialClick}
                    className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors cursor-pointer"
                  >
                    إنشاء حساب تجريبي 7 أيام
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4: Solutions */}
            <div className="space-y-3">
              <h4 className="text-sm font-black text-slate-900">حلول المنظومة</h4>
              <ul className="space-y-1.5 text-xs font-medium text-slate-600">
                <li>
                  <a href="/barbershop/" className="hover:text-emerald-700 transition-colors inline-block">
                    صالونات الحلاقة الرجالية
                  </a>
                </li>
                <li>
                  <a href="/beauty-salon/" className="hover:text-emerald-700 transition-colors inline-block">
                    المشاغل والصالونات النسائية
                  </a>
                </li>
                <li>
                  <a href="/salon-pos/" className="hover:text-emerald-700 transition-colors inline-block">
                    كاشير ونقاط البيع POS
                  </a>
                </li>
                <li>
                  <a href="/zatca-invoice/" className="hover:text-emerald-700 transition-colors inline-block">
                    الفاتورة الإلكترونية زاتكا ZATCA
                  </a>
                </li>
                <li>
                  <a href="/commissions-payroll/" className="hover:text-emerald-700 transition-colors inline-block">
                    عمولات ورواتب الموظفين والسلف
                  </a>
                </li>
                <li>
                  <a href="/spa-beauty-center/" className="hover:text-emerald-700 transition-colors inline-block">
                    بيوتي سنتر والسبا والمساج
                  </a>
                </li>
                <li>
                  <a href="/makeup-artist/" className="hover:text-emerald-700 transition-colors inline-block">
                    بوابة الميكب ارتست والعرائس
                  </a>
                </li>
                <li>
                  <a href="/online-booking/" className="hover:text-emerald-700 transition-colors inline-block">
                    حجز مواعيد أونلاين وتأكيد واتساب
                  </a>
                </li>
                <li>
                  <a href="/inventory-kiosk/" className="hover:text-emerald-700 transition-colors inline-block">
                    المخزون وكشك الانتظار Kiosk
                  </a>
                </li>
                <li>
                  <a href="/pricing-comparison/" className="hover:text-emerald-700 transition-colors inline-block font-bold text-emerald-700">
                    الأسعار ومقارنة البدائل
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 5: Contact Info (المطلوب: رقم الاتصال +201014889704) */}
            <div className="space-y-3">
              <h4 className="text-sm font-black text-slate-900">الاتصال والمبيعات</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                فريقنا جاهز للرد على استفساراتكم والمساعدة في بدء تشغيل المنظومة بصالونكم:
              </p>
              
              <div className="space-y-2 pt-1">
                {/* Phone Call Button */}
                <a
                  href={`tel:${contactPhone}`}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-all group"
                  dir="ltr"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Phone size={15} />
                  </div>
                  <span className="font-mono font-bold text-xs">{contactPhone}</span>
                </a>

                {/* WhatsApp Chat Button */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 transition-all group"
                  dir="ltr"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <MessageCircle size={15} />
                  </div>
                  <span className="font-bold text-xs">واتساب: {contactPhone}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-medium">
            <p>
              جميع الحقوق محفوظة © {new Date().getFullYear()} سمارت كت برو (Smart Cut Pro) - نظام إدارة صالونات التجميل.
            </p>
            <div className="flex items-center gap-4 text-slate-500">
              <span className="flex items-center gap-1.5">
                <Headphones size={14} className="text-emerald-600" />
                <span>دعم فني مباشر: {contactPhone}</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
