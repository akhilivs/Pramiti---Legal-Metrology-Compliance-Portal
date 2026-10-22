'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'hi';
const LANG_KEY = 'pramiti.lang';

/** English UI string -> Hindi. Strings missing here fall back to English. */
const HI: Record<string, string> = {
  // navigation & shell
  Inspect: 'निरीक्षण',
  'Inspection Register': 'निरीक्षण पंजी',
  Register: 'पंजी',
  'Bulk scan': 'थोक जाँच',
  Insights: 'विश्लेषण',
  Notices: 'नोटिस',
  Complaints: 'शिकायतें',
  'Rules Reference': 'नियम संदर्भ',
  Rules: 'नियम',
  Accuracy: 'सटीकता',
  'AI Accuracy': 'एआई सटीकता',
  Admin: 'प्रशासन',
  'Audit log': 'लेखा परीक्षा लॉग',
  Users: 'उपयोगकर्ता',
  Account: 'खाता',
  'Sign out': 'साइन आउट',
  'Legal Metrology Compliance Portal': 'विधिक माप विज्ञान अनुपालन पोर्टल',
  'Legal Metrology · Packaged Commodities Enforcement': 'विधिक माप विज्ञान · पैकेजबंद वस्तु प्रवर्तन',
  'Text size': 'अक्षर आकार',
  'Open menu': 'मेनू खोलें',
  'Close menu': 'मेनू बंद करें',
  'Language': 'भाषा',
  'Switch to dark mode': 'डार्क मोड चालू करें',
  'Switch to light mode': 'लाइट मोड चालू करें',
  'You are offline': 'आप ऑफ़लाइन हैं',
  'waiting to upload': 'अपलोड की प्रतीक्षा में',
  'Sync now': 'अभी सिंक करें',
  'Quick links': 'त्वरित लिंक',
  'Consumer grievances': 'उपभोक्ता शिकायत',
  'Report a product': 'उत्पाद की शिकायत करें',
  'Track complaint': 'शिकायत की स्थिति',
  inspector: 'निरीक्षक',
  controller: 'नियंत्रक',
  admin: 'प्रशासक',
  // dashboard
  'Good morning': 'सुप्रभात',
  'Good afternoon': 'नमस्कार',
  'Good evening': 'शुभ संध्या',
  Inspections: 'निरीक्षण',
  Compliant: 'अनुपालित',
  'Non-compliant': 'अननुपालित',
  'Needs review': 'समीक्षा आवश्यक',
  'Pending review': 'समीक्षा लंबित',
  'Open complaints': 'खुली शिकायतें',
  'Notices awaiting action': 'कार्रवाई हेतु नोटिस',
  'New inspection': 'नया निरीक्षण',
  'Product label': 'उत्पाद लेबल',
  'Online listing': 'ऑनलाइन लिस्टिंग',
  'Recent inspections': 'हाल के निरीक्षण',
  'Full register': 'पूरी पंजी',
  'Most frequent violations': 'सबसे सामान्य उल्लंघन',
  'Inspections, last 14 days': 'पिछले 14 दिनों के निरीक्षण',
  'The report will appear here': 'रिपोर्ट यहाँ दिखाई देगी',
  'Demo data loaded': 'डेमो डेटा लोड है',
  // scanner
  'Upload photos': 'फोटो अपलोड करें',
  'Live camera': 'लाइव कैमरा',
  'Analyse compliance': 'अनुपालन जाँचें',
  'Inspection details': 'निरीक्षण विवरण',
  optional: 'वैकल्पिक',
  State: 'राज्य',
  District: 'ज़िला',
  'Place of inspection': 'निरीक्षण स्थल',
  'Measured net quantity': 'मापी गई शुद्ध मात्रा',
  "Officer's notes": 'अधिकारी की टिप्पणी',
  'Select state': 'राज्य चुनें',
  'Saved offline': 'ऑफ़लाइन सहेजा गया',
  'Listing URL': 'लिस्टिंग URL',
  'Listing text': 'लिस्टिंग का पाठ',
  Screenshots: 'स्क्रीनशॉट',
  'Check listing': 'लिस्टिंग जाँचें',
  // report
  'Rule-wise findings': 'नियमवार निष्कर्ष',
  'Declarations read from the label': 'लेबल पर घोषणाएँ',
  'Full text transcribed from label': 'लेबल का पूरा पाठ',
  'PDF report': 'पीडीएफ़ रिपोर्ट',
  'Full record': 'पूरा अभिलेख',
  Action: 'कार्रवाई',
  Pass: 'सही',
  Fail: 'त्रुटि',
  Unclear: 'अस्पष्ट',
  'N/A': 'लागू नहीं',
  'Not found': 'नहीं मिला',
  'AI verdict': 'एआई निर्णय',
  'Officer review': 'अधिकारी समीक्षा',
  Reviewed: 'समीक्षित',
  'Review pending': 'समीक्षा लंबित',
  'Review findings': 'निष्कर्ष की समीक्षा करें',
  'Confirm review': 'समीक्षा की पुष्टि करें',
  Cancel: 'रद्द करें',
  Agree: 'सहमत',
  Override: 'बदलें',
  'Reason for override': 'बदलाव का कारण',
  'Raise show-cause notice': 'कारण बताओ नोटिस बनाएँ',
  'Show highlights': 'हाइलाइट दिखाएँ',
  Demo: 'डेमो',
  'Officer override': 'अधिकारी द्वारा संशोधित',
  // register
  'All sources': 'सभी स्रोत',
  'All states': 'सभी राज्य',
  All: 'सभी',
  'E-commerce': 'ई-कॉमर्स',
  Complaint: 'शिकायत',
  Label: 'लेबल',
  // notices
  Draft: 'मसौदा',
  Approved: 'स्वीकृत',
  Issued: 'जारी',
  Replied: 'उत्तर प्राप्त',
  Closed: 'बंद',
  Approve: 'स्वीकृत करें',
  Issue: 'जारी करें',
  'Record reply': 'उत्तर दर्ज करें',
  Close: 'बंद करें',
  Overdue: 'समय सीमा पार',
  // complaints
  Received: 'प्राप्त',
  'Under review': 'जाँच में',
  'Action taken': 'कार्रवाई की गई',
  'Assign to me': 'मुझे सौंपें',
  // misc
  Save: 'सहेजें',
  Delete: 'हटाएँ',
  Search: 'खोजें',
  Loading: 'लोड हो रहा है',
  Retry: 'पुनः प्रयास',
  Back: 'वापस',
  Print: 'प्रिंट',
};

/** Hindi names of checks, keyed by check id (titles come from the server in English). */
export const CHECK_HI: Record<string, string> = {
  manufacturer: 'निर्माता / पैकर / आयातक का नाम व पता',
  generic_name: 'वस्तु का सामान्य नाम',
  net_quantity: 'मानक इकाई में शुद्ध मात्रा',
  date: 'निर्माण / पैकिंग / आयात का माह-वर्ष',
  mrp: 'अधिकतम खुदरा मूल्य (सभी करों सहित)',
  mrp_integrity: 'एमआरपी से छेड़छाड़ नहीं (स्टिकर / ओवरराइटिंग)',
  unit_sale_price: 'इकाई विक्रय मूल्य',
  price_arithmetic: 'इकाई मूल्य = एमआरपी ÷ मात्रा',
  consumer_care: 'उपभोक्ता सेवा विवरण',
  best_before: 'उपयोग की अंतिम तिथि',
  country_of_origin: 'मूल देश (आयातित वस्तु)',
  pdp_legibility: 'मुख्य प्रदर्शन पैनल पर स्पष्ट घोषणा',
  font_size: 'अंकों की न्यूनतम ऊँचाई',
  ecommerce_display: 'लिस्टिंग पेज पर घोषणाएँ',
  quantity_verification: 'मापी गई मात्रा अनुमेय त्रुटि के भीतर',
};

export const FIELD_HI: Record<string, string> = {
  'Generic name': 'सामान्य नाम',
  'Manufacturer / Packer': 'निर्माता / पैकर',
  'Net quantity': 'शुद्ध मात्रा',
  MRP: 'अधिकतम खुदरा मूल्य',
  'Unit sale price': 'इकाई विक्रय मूल्य',
  'Mfg / Pkd date': 'निर्माण / पैकिंग तिथि',
  'Best before': 'उपयोग की अंतिम तिथि',
  'Consumer care': 'उपभोक्ता सेवा',
  'Country of origin': 'मूल देश',
  'Batch no.': 'बैच संख्या',
  'FSSAI licence': 'FSSAI लाइसेंस',
  Seller: 'विक्रेता',
};

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (s: string) => string;
}

const Ctx = createContext<I18n>({ lang: 'en', setLang: () => {}, t: (s) => s });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    // read the saved preference after hydration (server render is always English)
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LANG_KEY);
    } catch {}
    if (saved === 'hi') queueMicrotask(() => setLangState('hi'));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  }, []);

  const t = useCallback((s: string) => (lang === 'hi' ? (HI[s] ?? FIELD_HI[s] ?? s) : s), [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** Check title in the active language. */
export function useCheckTitle() {
  const { lang } = useI18n();
  return (c: { id: string; title: string }) => (lang === 'hi' && CHECK_HI[c.id]) || c.title;
}
