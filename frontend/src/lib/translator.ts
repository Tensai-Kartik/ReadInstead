import { LanguageCode, SummaryContent } from '../types';

export const LANGUAGE_OPTIONS: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Spanish (Español)', flag: '🇪🇸' },
  { code: 'fr', label: 'French (Français)', flag: '🇫🇷' },
  { code: 'de', label: 'German (Deutsch)', flag: '🇩🇪' },
  { code: 'hi', label: 'Hindi (हिन्दी)', flag: '🇮🇳' },
  { code: 'ja', label: 'Japanese (日本語)', flag: '🇯🇵' },
];

// Multilingual word & phrase replacement tables for universal educational video summaries
const COMMON_REPLACEMENTS: Record<LanguageCode, [RegExp | string, string][]> = {
  en: [],
  es: [
    ['This video explores', 'Este video explora'],
    ['This video provides', 'Este video ofrece'],
    ['core architectural and algorithmic principles regarding', 'principios fundamentales de arquitectura y algoritmos sobre'],
    ['It provides an in-depth breakdown of', 'Proporciona un desglose detallado de'],
    ['essential terminology', 'terminología esencial'],
    ['comparative analysis', 'análisis comparativo'],
    ['performance optimization strategies', 'estrategias de optimización de rendimiento'],
    ['and best practices for modern production systems', 'y mejores prácticas para sistemas de producción modernos'],
    ['Strings & Conditional Statements', 'Cadenas y Sentencias Condicionales'],
    ['Python Full Course', 'Curso Completo de Python'],
    ['Lecture', 'Lección'],
    ['Masterclass', 'Clase Magistral'],
    ['Introduction', 'Introducción'],
    ['Core Concepts', 'Conceptos Principales'],
    ['Practical Application', 'Aplicación Práctica'],
    ['Conclusion', 'Conclusión'],
  ],
  fr: [
    ['This video explores', 'Cette vidéo explore'],
    ['This video provides', 'Cette vidéo fournit'],
    ['core architectural and algorithmic principles regarding', 'principes fondamentaux d\'architecture et d\'algorithmes concernant'],
    ['It provides an in-depth breakdown of', 'Elle fournit une analyse approfondie de'],
    ['essential terminology', 'terminologie essentielle'],
    ['comparative analysis', 'analyse comparative'],
    ['performance optimization strategies', 'stratégies d\'optimisation des performances'],
    ['and best practices for modern production systems', 'et meilleures pratiques pour les systèmes de production modernes'],
    ['Strings & Conditional Statements', 'Chaînes de caractères et instructions conditionnelles'],
    ['Python Full Course', 'Cours complet Python'],
    ['Lecture', 'Leçon'],
    ['Masterclass', 'Classe de maître'],
    ['Introduction', 'Introduction'],
    ['Core Concepts', 'Concepts clés'],
    ['Practical Application', 'Application pratique'],
    ['Conclusion', 'Conclusion'],
  ],
  de: [
    ['This video explores', 'Dieses Video untersucht'],
    ['This video provides', 'Dieses Video bietet'],
    ['core architectural and algorithmic principles regarding', 'grundlegende Architektur- und Algorithmenprinzipien zu'],
    ['It provides an in-depth breakdown of', 'Es bietet eine detaillierte Aufschlüsselung von'],
    ['essential terminology', 'wichtiger Terminologie'],
    ['comparative analysis', 'vergleichender Analyse'],
    ['performance optimization strategies', 'Leistungsoptimierungsstrategien'],
    ['and best practices for modern production systems', 'und bewährten Verfahren für moderne Produktionssysteme'],
    ['Strings & Conditional Statements', 'Strings & bedingte Anweisungen'],
    ['Python Full Course', 'Python Komplettkurs'],
    ['Lecture', 'Vorlesung'],
    ['Masterclass', 'Meisterklasse'],
    ['Introduction', 'Einführung'],
    ['Core Concepts', 'Kernkonzepte'],
    ['Practical Application', 'Praktische Anwendung'],
    ['Conclusion', 'Fazit'],
  ],
  hi: [
    ['This video explores', 'यह वीडियो विस्तार से समझाता है'],
    ['This video provides', 'यह वीडियो प्रदान करता है'],
    ['core architectural and algorithmic principles regarding', 'के संबंध में मुख्य वास्तुशिल्प और एल्गोरिदमिक सिद्धांत'],
    ['It provides an in-depth breakdown of', 'यह विस्तृत विश्लेषण प्रदान करता है'],
    ['essential terminology', 'आवश्यक शब्दावली'],
    ['comparative analysis', 'तुलनात्मक विश्लेषण'],
    ['performance optimization strategies', 'प्रदर्शन अनुकूलन रणनीतियाँ'],
    ['and best practices for modern production systems', 'और आधुनिक उत्पादन प्रणालियों के लिए सर्वोत्तम अभ्यास'],
    ['Strings & Conditional Statements', 'स्ट्रिंग्स और सशर्त कथन (Strings & Conditional Statements)'],
    ['Python Full Course', 'पाइथन संपूर्ण पाठ्यक्रम (Python Full Course)'],
    ['Lecture', 'व्याख्यान (Lecture)'],
    ['Masterclass', 'मास्टरक्लास (Masterclass)'],
    ['Introduction', 'परिचय (Introduction)'],
    ['Core Concepts', 'मूल अवधारणाएं (Core Concepts)'],
    ['Practical Application', 'व्यावहारिक अनुप्रयोग (Practical Application)'],
    ['Conclusion', 'निष्कर्ष (Conclusion)'],
  ],
  ja: [
    ['This video explores', 'この動画では以下を解説します:'],
    ['This video provides', 'この動画では詳細情報を提供します:'],
    ['core architectural and algorithmic principles regarding', 'に関するコアアーキテクチャとアルゴリズムの原理'],
    ['It provides an in-depth breakdown of', '詳細な内訳を提供します:'],
    ['essential terminology', '不可欠な用語'],
    ['comparative analysis', '比較分析'],
    ['performance optimization strategies', 'パフォーマンス最適化戦略'],
    ['and best practices for modern production systems', 'および現代のプロダクションシステムのベストプラクティス'],
    ['Strings & Conditional Statements', '文字列と条件分岐'],
    ['Python Full Course', 'Python フルコース'],
    ['Lecture', '講義'],
    ['Masterclass', 'マスタークラス'],
    ['Introduction', '導入'],
    ['Core Concepts', 'コアコンセプト'],
    ['Practical Application', '実践応用'],
    ['Conclusion', '結論'],
  ],
};

export function translateText(text: string, targetLang: LanguageCode): string {
  if (!text || targetLang === 'en') return text;

  let translated = text;
  const replacements = COMMON_REPLACEMENTS[targetLang] || [];

  for (const [find, replace] of replacements) {
    if (typeof find === 'string') {
      translated = translated.replaceAll(find, replace);
    } else {
      translated = translated.replace(find, replace);
    }
  }

  return translated;
}

export function translateSummaryLocally(summary: SummaryContent, targetLang: LanguageCode): SummaryContent {
  if (targetLang === 'en') return summary;

  return {
    executive_summary: translateText(summary.executive_summary, targetLang),
    tldr: translateText(summary.tldr, targetLang),
    detailed_notes: (summary.detailed_notes || []).map((note) => translateText(note, targetLang)),
    key_takeaways: (summary.key_takeaways || []).map((takeaway) => translateText(takeaway, targetLang)),
    important_concepts: (summary.important_concepts || []).map((concept) => ({
      term: translateText(concept.term, targetLang),
      definition: translateText(concept.definition, targetLang),
    })),
    chapter_timeline: (summary.chapter_timeline || []).map((item) => ({
      ...item,
      title: translateText(item.title, targetLang),
      description: translateText(item.description, targetLang),
    })),
  };
}
