export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  noindex?: boolean;
}

export const SITE_CONFIG = {
  siteName: 'Lutfan AI',
  domain: 'https://lutfanai.uz',
  defaultImage: '/favicon-512.png',
  telegramBot: 'lutfan_ai_bot',
  languages: ['uz-latn', 'uz-cyrl', 'ru'] as const,
} as const;

// SEO configurations for all pages in different languages
export const SEO_CONFIGS: Record<string, Record<string, SEOConfig>> = {
  home: {
    'uz-latn': {
      title: 'Lutfan AI — Sun\'iy intellekt yordamida premium taklifnoma yaratish',
      description: 'Lutfan AI — nikoh, aqiqa, tug\'ilgan kun va bayramlar uchun AI yordamida professional elektron taklifnoma yaratish platformasi. Online taklifnoma tez va oson!',
      keywords: 'lutfan ai, ai taklifnoma, elektron taklifnoma, online taklifnoma, premium taklifnoma, nikoh taklifnomasi, aqiqa taklifnomasi, tug\'ilgan kun taklifnomasi, digital invitation uzbekistan',
      type: 'website',
    },
    'uz-cyrl': {
      title: 'Lutfan AI — Сунъий интеллект ёрдамида премиум таклифнома яратиш',
      description: 'Lutfan AI — никоҳ, ақиқа, туғилган кун ва байрамлар учун AI ёрдамида профессионал электрон таклифнома яратиш платформаси. Онлайн таклифнома тез ва осон!',
      keywords: 'lutfan ai, ai таклифнома, электрон таклифнома, онлайн таклифнома, премиум таклифнома, никоҳ таклифномаси, ақиқа таклифномаси, туғилган кун таклифномаси',
      type: 'website',
    },
    ru: {
      title: 'Lutfan AI — Создание премиум приглашений с помощью искусственного интеллекта',
      description: 'Lutfan AI — платформа для создания профессиональных электронных приглашений с помощью AI для свадеб, дней рождения, праздников. Онлайн приглашения быстро и легко!',
      keywords: 'lutfan ai, ai приглашения, электронные приглашения, онлайн приглашения, премиум приглашения, свадебные приглашения, приглашения на день рождения',
      type: 'website',
    },
  },
  gallery: {
    'uz-latn': {
      title: 'Namunalar galereyasi — Lutfan AI',
      description: 'Lutfan AI platformasida yaratilgan nikoh, aqiqa, tug\'ilgan kun va bayram taklifnomalari namunalari. Ilhom oling va o\'zingiznikini yarating!',
      type: 'website',
    },
    'uz-cyrl': {
      title: 'Намуналар галереяси — Lutfan AI',
      description: 'Lutfan AI платформасида яратилган никоҳ, ақиқа, туғилган кун ва байрам таклифномалари намуналари. Илҳом олинг ва ўзингизникини яратинг!',
      type: 'website',
    },
    ru: {
      title: 'Галерея примеров — Lutfan AI',
      description: 'Примеры приглашений на свадьбу, дни рождения и праздники, созданных на платформе Lutfan AI. Вдохновляйтесь и создавайте свои!',
      type: 'website',
    },
  },
  howItWorks: {
    'uz-latn': {
      title: 'Qanday ishlaydi — Lutfan AI',
      description: 'Lutfan AI bilan 5 daqiqada professional taklifnoma yarating. Oddiy qadamlar: tadbir turini tanlang, ma\'lumotlarni kiriting, dizaynni sozlang va tayyor!',
      type: 'website',
    },
    'uz-cyrl': {
      title: 'Қандай ишлайди — Lutfan AI',
      description: 'Lutfan AI билан 5 дақиқада профессионал таклифнома яратинг. Оддий қадамлар: тадбир турини танланг, маълумотларни киритинг, дизайнни созланг ва тайёр!',
      type: 'website',
    },
    ru: {
      title: 'Как это работает — Lutfan AI',
      description: 'Создайте профессиональное приглашение с Lutfan AI за 5 минут. Простые шаги: выберите тип события, введите данные, настройте дизайн и готово!',
      type: 'website',
    },
  },
  faq: {
    'uz-latn': {
      title: 'Tez-tez so\'raladigan savollar — Lutfan AI',
      description: 'Lutfan AI platformasi haqida eng ko\'p so\'raladigan savollarga javoblar. Taklifnoma yaratish, narxlar, to\'lov va qo\'llab-quvvatlash haqida.',
      type: 'website',
    },
    'uz-cyrl': {
      title: 'Тез-тез сўраладиган саволлар — Lutfan AI',
      description: 'Lutfan AI платформаси ҳақида энг кўп сўраладиган саволларга жавоблар. Таклифнома яратиш, нархлар, тўлов ва қўллаб-қувватлаш ҳақида.',
      type: 'website',
    },
    ru: {
      title: 'Часто задаваемые вопросы — Lutfan AI',
      description: 'Ответы на самые частые вопросы о платформе Lutfan AI. Создание приглашений, цены, оплата и поддержка.',
      type: 'website',
    },
  },
  privacy: {
    'uz-latn': {
      title: 'Maxfiylik siyosati — Lutfan AI',
      description: 'Lutfan AI maxfiylik siyosati va shaxsiy ma\'lumotlarni himoya qilish qoidalari.',
      type: 'website',
      noindex: true,
    },
    'uz-cyrl': {
      title: 'Махфийлик сиёсати — Lutfan AI',
      description: 'Lutfan AI махфийлик сиёсати ва шахсий маълумотларни ҳимоя қилиш қоидалари.',
      type: 'website',
      noindex: true,
    },
    ru: {
      title: 'Политика конфиденциальности — Lutfan AI',
      description: 'Политика конфиденциальности Lutfan AI и правила защиты персональных данных.',
      type: 'website',
      noindex: true,
    },
  },
  terms: {
    'uz-latn': {
      title: 'Foydalanish shartlari — Lutfan AI',
      description: 'Lutfan AI platformasidan foydalanish shartlari va qoidalari.',
      type: 'website',
      noindex: true,
    },
    'uz-cyrl': {
      title: 'Фойдаланиш шартлари — Lutfan AI',
      description: 'Lutfan AI платформасидан фойдаланиш шартлари ва қоидалари.',
      type: 'website',
      noindex: true,
    },
    ru: {
      title: 'Условия использования — Lutfan AI',
      description: 'Условия использования и правила платформы Lutfan AI.',
      type: 'website',
      noindex: true,
    },
  },
  account: {
    'uz-latn': {
      title: 'Mening hisobim — Lutfan AI',
      description: 'Shaxsiy kabinet — taklifnomalaringizni boshqaring va tahrirлang.',
      type: 'website',
      noindex: true,
    },
    'uz-cyrl': {
      title: 'Менинг ҳисобим — Lutfan AI',
      description: 'Шахсий кабинет — таклифномаларингизни бошқаринг ва таҳрирланг.',
      type: 'website',
      noindex: true,
    },
    ru: {
      title: 'Мой аккаунт — Lutfan AI',
      description: 'Личный кабинет — управляйте и редактируйте свои приглашения.',
      type: 'website',
      noindex: true,
    },
  },
};

export function getSEOConfig(page: string, language: string = 'uz-latn'): SEOConfig {
  const pageConfig = SEO_CONFIGS[page];
  if (!pageConfig) {
    return SEO_CONFIGS.home[language];
  }
  return pageConfig[language] || pageConfig['uz-latn'];
}

export function getCanonicalUrl(path: string = ''): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_CONFIG.domain}${cleanPath}`;
}

export function getAlternateUrls(path: string = ''): Array<{ lang: string; url: string }> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return [
    { lang: 'uz-Latn', url: `${SITE_CONFIG.domain}${cleanPath}` },
    { lang: 'uz-Cyrl', url: `${SITE_CONFIG.domain}${cleanPath}` },
    { lang: 'ru', url: `${SITE_CONFIG.domain}${cleanPath}` },
    { lang: 'x-default', url: `${SITE_CONFIG.domain}${cleanPath}` },
  ];
}

export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Lutfan AI',
    url: SITE_CONFIG.domain,
    logo: `${SITE_CONFIG.domain}/favicon-512.png`,
    description: 'AI-powered premium digital invitation platform for Uzbekistan',
    sameAs: [
      `https://t.me/${SITE_CONFIG.telegramBot}`,
    ],
  };
}

export function getWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Lutfan AI',
    url: SITE_CONFIG.domain,
    description: 'Create premium digital invitations with AI',
    publisher: {
      '@type': 'Organization',
      name: 'Lutfan AI',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_CONFIG.domain}/favicon-512.png`,
      },
    },
  };
}

export function getEventSchema(eventType: string, eventData?: any) {
  const eventTypeMap: Record<string, string> = {
    nikoh: 'WeddingEvent',
    birthday: 'SocialEvent',
    aqiqa: 'SocialEvent',
    sunnat: 'SocialEvent',
    hudoyi: 'SocialEvent',
    hayit: 'SocialEvent',
  };

  if (!eventData) return null;

  return {
    '@context': 'https://schema.org',
    '@type': eventTypeMap[eventType] || 'SocialEvent',
    name: eventData.name || 'Event',
    description: eventData.description,
    startDate: eventData.startDate,
    location: eventData.location ? {
      '@type': 'Place',
      name: eventData.location.name,
      address: eventData.location.address,
    } : undefined,
  };
}
