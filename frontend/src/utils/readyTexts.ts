import type { TextTemplate } from "../api/client";

type Lang = "uz-latn" | "uz-cyrl" | "ru";

type Draft = {
  id: string;
  title: Record<Lang, string>;
  text: Record<Lang, string>;
};

function pack(
  eventSlug: string,
  language: string,
  drafts: Draft[],
): TextTemplate[] {
  const lang = (["uz-latn", "uz-cyrl", "ru"].includes(language)
    ? language
    : "uz-latn") as Lang;

  const nameLine =
    eventSlug === "aqiqa" || eventSlug === "sunnat"
      ? "{child_name}\n"
      : eventSlug === "birthday"
        ? "{person_name}\n"
        : "";

  const withDate = eventSlug !== "hayit";
  const dateLine = withDate
    ? lang === "ru"
      ? "{event_date}, в {event_time}\n"
      : lang === "uz-cyrl"
        ? "{event_date}, соат {event_time} да\n"
        : "{event_date}, soat {event_time} da\n"
    : "";

  return drafts.map((d) => {
    return {
      id: `local-${eventSlug}-${lang}-${d.id}`,
      title: d.title[lang],
      language: lang,
      tone: "classic",
      preview_text: `${d.text[lang].trim()}\n${nameLine}${dateLine}{venue_name}, {venue_address}`,
    };
  });
}

const NIKOH: Draft[] = [
  {
    id: "classic1",
    title: { "uz-latn": "Klassik 1", "uz-cyrl": "Классик 1", ru: "Классика 1" },
    text: {
      "uz-latn":
        "Assalomu alaykum!\nAziz mehmonimiz, Sizni nikoh to‘yimizga samimiy taklif etamiz. Baxtli kunimizni Siz bilan birga nishonlash biz uchun katta sharafdir. Ushbu qutlug‘ kunda Sizning tashrifingiz bayramimizga alohida fayz bag‘ishlaydi. Quvonchimizga sherik bo‘lishingizni intizorlik bilan kutamiz.",
      "uz-cyrl":
        "Ассалому алайкум!\nАзиз меҳмонимиз, Сизни никоҳ тўйимизга самимий таклиф этамиз. Бахтли кунимизни Сиз билан бирга нишонлаш биз учун катта шарафдир. Ушбу қутлуғ кунда Сизнинг ташрифингиз байрамимизга алоҳида файз бағишлайди. Қувончимизга шерик бўлишингизни интизорлик билан кутамиз.",
      ru: "Ассаламу алейкум!\nДорогой гость, искренне приглашаем Вас на нашу свадьбу. Для нас большая честь разделить этот счастливый день с Вами. Ваш визит придаст нашему празднику особое тепло. С нетерпением ждём, что Вы разделите с нами нашу радость.",
    },
  },
  {
    id: "warm1",
    title: { "uz-latn": "Samimiy 1", "uz-cyrl": "Самимий 1", ru: "Тёплое 1" },
    text: {
      "uz-latn":
        "Hurmatli mehmonimiz!\nOilamizning eng quvonchli kuni — nikoh to‘yimizga Sizni chin dildan taklif qilamiz. Kelib, duolaringiz va ezgu tilaklaringiz bilan quvonchimizga sherik bo‘ling. Ushbu unutilmas lahzalarni Siz bilan birga baham ko‘rish biz uchun katta baxtdir. Tashrifingiz biz uchun eng qadrli sovg‘alardan biri bo‘ladi.",
      "uz-cyrl":
        "Ҳурматли меҳмонимиз!\nОиламизнинг энг қувончли куни — никоҳ тўйимизга Сизни чин дилдан таклиф қиламиз. Келиб, дуоларингиз ва эзгу тилакларингиз билан қувончимизга шерик бўлинг. Ушбу унутилмас лаҳзаларни Сиз билан бирга баҳам кўриш биз учун катта бахтдир. Ташрифингиз биз учун энг қадрли совғалардан бири бўлади.",
      ru: "Уважаемый гость!\nОт всей души приглашаем Вас на самый радостный день нашей семьи — нашу свадьбу. Приходите и разделите нашу радость своими добрыми пожеланиями и молитвами. Для нас большое счастье прожить эти незабываемые мгновения вместе с Вами. Ваш визит станет для нас одним из самых ценных подарков.",
    },
  },
  {
    id: "classic2",
    title: { "uz-latn": "Klassik 2", "uz-cyrl": "Классик 2", ru: "Классика 2" },
    text: {
      "uz-latn":
        "Aziz mehmonlar!\nHayotimizning yangi sahifasi boshlanayotgan nikoh to‘yimizga Sizni hurmat bilan chorlaymiz. Ushbu qutlug‘ kunda Sizni mehmonlarimiz safida ko‘rish biz uchun alohida mamnuniyat. Tashrifingiz bayramimizga yanada ko‘rk bag‘ishlaydi. Quvonchli daqiqalarimizni birga o‘tkazishni intizorlik bilan kutamiz.",
      "uz-cyrl":
        "Азиз меҳмонлар!\nҲаётимизнинг янги саҳифаси бошланаётган никоҳ тўйимизга Сизни ҳурмат билан чорлаймиз. Ушбу қутлуғ кунда Сизни меҳмонларимиз сафида кўриш биз учун алоҳида мамнуният. Ташрифингиз байрамимизга янада кўрк бағишлайди. Қувончли дақиқаларимизни бирга ўтказишни интизорлик билан кутамиз.",
      ru: "Дорогие гости!\nС уважением приглашаем Вас на нашу свадьбу — день, когда начинается новая страница нашей жизни. Будем особенно рады видеть Вас среди наших гостей. Ваш визит сделает наш праздник ещё прекраснее. С нетерпением ждём, чтобы разделить с Вами эти радостные минуты.",
    },
  },
  {
    id: "warm2",
    title: { "uz-latn": "Samimiy 2", "uz-cyrl": "Самимий 2", ru: "Тёплое 2" },
    text: {
      "uz-latn":
        "Aziz mehmonlar!\nYuragimizdagi eng iliqlik bilan Sizni nikoh dasturxonimizga taklif qilamiz. Ushbu qutlug‘ lahzalarni Siz bilan baham ko‘rish biz uchun ulkan baxtdir. Ezgu tilaklaringiz va samimiy duolaringiz quvonchimizni yanada ziyoda qiladi. Kelib, oilaviy shodligimizga sherik bo‘ling.",
      "uz-cyrl":
        "Азиз меҳмонлар!\nЮрагимиздаги энг илиқлик билан Сизни никоҳ дастурхонимизга таклиф қиламиз. Ушбу қутлуғ лаҳзаларни Сиз билан баҳам кўриш биз учун улкан бахтдир. Эзгу тилакларингиз ва самимий дуоларингиз қувончимизни янада зиёда қилади. Келиб, оилавий шодлигимизга шерик бўлинг.",
      ru: "Дорогие гости!\nОт всего сердца приглашаем Вас за наш свадебный дастархан. Делить с Вами эти благословенные мгновения — огромное счастье для нас. Ваши добрые пожелания и искренние молитвы сделают нашу радость ещё полнее. Приходите и разделите семейную радость вместе с нами.",
    },
  },
  {
    id: "formal",
    title: {
      "uz-latn": "Tantanavor",
      "uz-cyrl": "Тантанавор",
      ru: "Торжественный",
    },
    text: {
      "uz-latn":
        "Aziz mehmonlar!\nSizni yuksak hurmat va ehtirom ila nikoh to‘yimizga taklif etamiz. Ushbu quvonchli kunimizda tashrifingiz biz uchun alohida mamnuniyat bag‘ishlaydi. Ikki qalbning birlashuviga guvoh bo‘lib, quvonchimizni baham ko‘rishingizni so‘raymiz. Ushbu tantanaga tashrifingiz biz uchun yuksak ehtiromdir.",
      "uz-cyrl":
        "Азиз меҳмонлар!\nСизни юксак ҳурмат ва эҳтиром ила никоҳ тўйимизга таклиф этамиз. Ушбу қувончли кунимизда ташрифингиз биз учун алоҳида мамнуният бағишлайди. Икки қалбнинг бирлашувига гувоҳ бўлиб, қувончимизни баҳам кўришингизни сўраймиз. Ушбу тантанага ташрифингиз биз учун юксак эҳтиромдир.",
      ru: "Дорогие гости!\nС глубоким уважением приглашаем Вас на нашу свадьбу. Ваш визит в этот радостный день будет для нас особой честью. Просим Вас стать свидетелями соединения двух сердец и разделить с нами нашу радость. Ваше присутствие на этом торжестве — для нас высокая честь.",
    },
  },
  {
    id: "dua",
    title: { "uz-latn": "Duoli", "uz-cyrl": "Дуоли", ru: "С дуа" },
    text: {
      "uz-latn":
        "Aziz mehmonlar!\nSizni nikoh to‘yimizga samimiy taklif etamiz. Baxtli kunimizni Siz bilan birga nishonlash biz uchun katta sharafdir. Yaratgandan oilamizga baraka, mehr va saodat ato etishini so‘raymiz. Sizning duolaringiz va ezgu tilaklaringiz ushbu kunimizning eng qimmatli bezagi bo‘ladi.",
      "uz-cyrl":
        "Азиз меҳмонлар!\nСизни никоҳ тўйимизга самимий таклиф этамиз. Бахтли кунимизни Сиз билан бирга нишонлаш биз учун катта шарафдир. Яратгандан оиламизга барака, меҳр ва саодат ато этишини сўраймиз. Сизнинг дуоларингиз ва эзгу тилакларингиз ушбу кунимизнинг энг қимматли безаги бўлади.",
      ru: "Дорогие гости!\nИскренне приглашаем Вас на нашу свадьбу. Для нас большая честь разделить этот счастливый день с Вами. Просим Всевышнего даровать нашей семье благословение, любовь и благополучие. Ваши молитвы и добрые пожелания станут самым ценным украшением этого дня.",
    },
  },
  {
    id: "minimal",
    title: {
      "uz-latn": "Qisqa va lo‘nda",
      "uz-cyrl": "Қисқа ва лўнда",
      ru: "Кратко",
    },
    text: {
      "uz-latn":
        "Aziz mehmonlar!\nSizni nikoh to‘yimizga taklif etamiz. Qadrli mehmonimiz sifatida tashrif buyurishingizdan mamnun bo‘lamiz. Quvonchli kunimizda Siz bilan birga bo‘lish biz uchun katta baxtdir. Tashrifingizni intizorlik bilan kutamiz.",
      "uz-cyrl":
        "Азиз меҳмонлар!\nСизни никоҳ тўйимизга таклиф этамиз. Қадрли меҳмонимиз сифатида ташриф буюришингиздан мамнун бўламиз. Қувончли кунимизда Сиз билан бирга бўлиш биз учун катта бахтдир. Ташрифингизни интизорлик билан кутамиз.",
      ru: "Дорогие гости!\nПриглашаем Вас на нашу свадьбу. Будем рады видеть Вас как дорогого гостя. Для нас большое счастье провести этот радостный день вместе с Вами. С нетерпением ждём Вашего визита.",
    },
  },
  {
    id: "modern",
    title: {
      "uz-latn": "Zamonaviy",
      "uz-cyrl": "Замонавий",
      ru: "Современный",
    },
    text: {
      "uz-latn":
        "Aziz mehmonlar!\nSizning tashrifingiz bayramimizni yanada go‘zal va fayzli qiladi. Keling, birgalikda unutilmas xotiralar yarataylik. Hayotimizdagi eng muhim kunlardan birini Siz bilan baham ko‘rishdan mamnun bo‘lamiz. Samimiy davra va quvonchli lahzalar Sizni kutmoqda.",
      "uz-cyrl":
        "Азиз меҳмонлар!\nСизнинг ташрифингиз байрамимизни янада гўзал ва файзли қилади. Келинг, биргаликда унутилмас хотиралар яратайлик. Ҳаётимиздаги энг муҳим кунлардан бирини Сиз билан баҳам кўришдан мамнун бўламиз. Самимий давра ва қувончли лаҳзалар Сизни кутмоқда.",
      ru: "Дорогие гости!\nВаш визит сделает наш праздник ещё прекраснее и теплее. Давайте вместе создадим незабываемые воспоминания. Будем рады разделить с Вами один из самых важных дней нашей жизни. Вас ждут тёплая компания и радостные мгновения.",
    },
  },
  {
    id: "premium",
    title: {
      "uz-latn": "Premium variant",
      "uz-cyrl": "Премиум вариант",
      ru: "Премиум",
    },
    text: {
      "uz-latn":
        "Aziz va qadrli mehmonlar!\nSizni hayotimizdagi eng quvonchli va unutilmas kun — nikoh to‘yimizga samimiy taklif etamiz. Ikki qalbni birlashtirayotgan ushbu qutlug‘ lahzalarda Sizning tashrifingiz biz uchun alohida ahamiyatga ega. Ezgu tilak va duolaringiz bilan quvonchimizga sherik bo‘lishingizni chin dildan istaymiz. Ushbu baxtiyor kunimizni Siz bilan birga nishonlash biz uchun katta sharaf va baxtdir.",
      "uz-cyrl":
        "Азиз ва қадрли меҳмонлар!\nСизни ҳаётимиздаги энг қувончли ва унутилмас кун — никоҳ тўйимизга самимий таклиф этамиз. Икки қалбни бирлаштираётган ушбу қутлуғ лаҳзаларда Сизнинг ташрифингиз биз учун алоҳида аҳамиятга эга. Эзгу тилак ва дуоларингиз билан қувончимизга шерик бўлишингизни чин дилдан истаймиз. Ушбу бахтиёр кунимизни Сиз билан бирга нишонлаш биз учун катта шараф ва бахтдир.",
      ru: "Дорогие и уважаемые гости!\nИскренне приглашаем Вас на самый радостный и незабываемый день нашей жизни — нашу свадьбу. В эти благословенные мгновения соединения двух сердец Ваш визит имеет для нас особое значение. От всей души желаем, чтобы Вы разделили нашу радость добрыми пожеланиями и молитвами. Разделить с Вами этот счастливый день — для нас большая честь и радость.",
    },
  },
];

function eventDrafts(slug: string): Draft[] {
  if (slug === "nikoh") return NIKOH;

  const topic: Record<
    string,
    { latn: string; cyrl: string; ru: string; aboutLatn: string; aboutCyrl: string; aboutRu: string }
  > = {
    aqiqa: {
      latn: "aqiqa marosimi",
      cyrl: "ақиқа маросими",
      ru: "акику",
      aboutLatn: "farzandimiz aqiqa marosimi",
      aboutCyrl: "фарзандимиз ақиқа маросими",
      aboutRu: "акики нашего ребёнка",
    },
    sunnat: {
      latn: "sunnat to‘yi",
      cyrl: "суннат тўйи",
      ru: "суннат той",
      aboutLatn: "o‘g‘limizning sunnat to‘yi",
      aboutCyrl: "ўғлимизнинг суннат тўйи",
      aboutRu: "суннат тоя нашего сына",
    },
    birthday: {
      latn: "tug‘ilgan kun bayrami",
      cyrl: "туғилган кун байрами",
      ru: "день рождения",
      aboutLatn: "tug‘ilgan kun bayramimiz",
      aboutCyrl: "туғилган кун байрамимиз",
      aboutRu: "день рождения",
    },
    hudoyi: {
      latn: "hudoyi dasturxoni",
      cyrl: "худойи дастурхони",
      ru: "худое",
      aboutLatn: "hudoyi dasturxonimiz",
      aboutCyrl: "худойи дастурхонимиз",
      aboutRu: "худое",
    },
    hayit: {
      latn: "{hayit_occasion} ziyofati",
      cyrl: "{hayit_occasion} зиёфати",
      ru: "{hayit_occasion}",
      aboutLatn: "{hayit_occasion} ziyofatimiz",
      aboutCyrl: "{hayit_occasion} зиёфатимиз",
      aboutRu: "{hayit_occasion}",
    },
  };

  const e = topic[slug] || {
    latn: "tadbirimiz",
    cyrl: "тадбиримиз",
    ru: "наше торжество",
    aboutLatn: "tadbirimiz",
    aboutCyrl: "тадбиримиз",
    aboutRu: "наше торжество",
  };

  return [
    {
      id: "classic1",
      title: { "uz-latn": "Klassik 1", "uz-cyrl": "Классик 1", ru: "Классика 1" },
      text: {
        "uz-latn": `Assalomu alaykum!\nAziz mehmonimiz, Sizni ${e.aboutLatn}ga samimiy taklif etamiz. Ushbu quvonchli kunni Siz bilan birga nishonlash biz uchun katta sharafdir. Tashrifingiz bayramimizga alohida fayz bag‘ishlaydi. Quvonchimizga sherik bo‘lishingizni intizorlik bilan kutamiz.`,
        "uz-cyrl": `Ассалому алайкум!\nАзиз меҳмонимиз, Сизни ${e.aboutCyrl}га самимий таклиф этамиз. Ушбу қувончли кунни Сиз билан бирга нишонлаш биз учун катта шарафдир. Ташрифингиз байрамимизга алоҳида файз бағишлайди. Қувончимизга шерик бўлишингизни интизорлик билан кутамиз.`,
        ru: `Ассаламу алейкум!\nДорогой гость, искренне приглашаем Вас на ${e.aboutRu}. Для нас большая честь разделить этот радостный день с Вами. Ваш визит придаст нашему празднику особое тепло. С нетерпением ждём, что Вы разделите с нами нашу радость.`,
      },
    },
    {
      id: "warm1",
      title: { "uz-latn": "Samimiy 1", "uz-cyrl": "Самимий 1", ru: "Тёплое 1" },
      text: {
        "uz-latn": `Hurmatli mehmonimiz!\nOilamizning quvonchli kuni — ${e.aboutLatn}ga Sizni chin dildan taklif qilamiz. Kelib, samimiy tabrik va ezgu tilaklaringiz bilan quvonchimizga sherik bo‘ling. Ushbu unutilmas lahzalarni Siz bilan birga baham ko‘rish biz uchun katta baxtdir. Tashrifingiz biz uchun eng qadrli sovg‘alardan biri bo‘ladi.`,
        "uz-cyrl": `Ҳурматли меҳмонимиз!\nОиламизнинг қувончли куни — ${e.aboutCyrl}га Сизни чин дилдан таклиф қиламиз. Келиб, дуоларингиз ва эзгу тилакларингиз билан қувончимизга шерик бўлинг. Ушбу унутилмас лаҳзаларни Сиз билан бирга баҳам кўриш биз учун катта бахтдир. Ташрифингиз биз учун энг қадрли совғалардан бири бўлади.`,
        ru: `Уважаемый гость!\nОт всей души приглашаем Вас на радостный день нашей семьи — ${e.aboutRu}. Приходите и разделите нашу радость своими добрыми пожеланиями. Для нас большое счастье прожить эти незабываемые мгновения вместе с Вами. Ваш визит станет для нас одним из самых ценных подарков.`,
      },
    },
    {
      id: "classic2",
      title: { "uz-latn": "Klassik 2", "uz-cyrl": "Классик 2", ru: "Классика 2" },
      text: {
        "uz-latn": `Aziz mehmonlar!\nSizni ${e.aboutLatn}ga samimiy taklif etamiz. Quvonchli kunimizni Siz bilan birga nishonlash biz uchun katta sharafdir. Ushbu kunda Sizni mehmonlarimiz safida ko‘rishdan mamnun bo‘lamiz. Tashrifingiz bayramimizga yanada ko‘rk bag‘ishlaydi.`,
        "uz-cyrl": `Азиз меҳмонлар!\nСизни ${e.aboutCyrl}га самимий таклиф этамиз. Қувончли кунимизни Сиз билан бирга нишонлаш биз учун катта шарафдир. Ушбу кунда Сизни меҳмонларимиз сафида кўришдан мамнун бўламиз. Ташрифингиз байрамимизга янада кўрк бағишлайди.`,
        ru: `Дорогие гости!\nИскренне приглашаем Вас на ${e.aboutRu}. Для нас большая честь разделить этот радостный день с Вами. Будем рады видеть Вас среди наших гостей. Ваш визит сделает наш праздник ещё прекраснее.`,
      },
    },
    {
      id: "warm2",
      title: { "uz-latn": "Samimiy 2", "uz-cyrl": "Самимий 2", ru: "Тёплое 2" },
      text: {
        "uz-latn": `Aziz mehmonlar!\nSizni ${e.aboutLatn}ga samimiy taklif etamiz. Ushbu qutlug‘ lahzalarni Siz bilan baham ko‘rish biz uchun ulkan baxtdir. Ezgu tilaklaringiz va samimiy duolaringiz quvonchimizni yanada ziyoda qiladi. Tashrifingizni chin dildan kutamiz.`,
        "uz-cyrl": `Азиз меҳмонлар!\nСизни ${e.aboutCyrl}га самимий таклиф этамиз. Ушбу қутлуғ лаҳзаларни Сиз билан баҳам кўриш биз учун улкан бахтдир. Эзгу тилакларингиз ва самимий дуоларингиз қувончимизни янада зиёда қилади. Ташрифингизни чин дилдан кутамиз.`,
        ru: `Дорогие гости!\nИскренне приглашаем Вас на ${e.aboutRu}. Делить с Вами эти благословенные мгновения — огромное счастье для нас. Ваши добрые пожелания сделают нашу радость ещё полнее. От всей души ждём Вашего визита.`,
      },
    },
    {
      id: "formal",
      title: {
        "uz-latn": "Tantanavor",
        "uz-cyrl": "Тантанавор",
        ru: "Торжественный",
      },
      text: {
        "uz-latn": `Aziz mehmonlar!\nSizni yuksak hurmat va ehtirom ila ${e.aboutLatn}ga taklif etamiz. Ushbu quvonchli kunimizda tashrifingiz biz uchun alohida mamnuniyat bag‘ishlaydi. Quvonchimizni baham ko‘rishingizni so‘raymiz. Ushbu tantanaga tashrifingiz biz uchun yuksak ehtiromdir.`,
        "uz-cyrl": `Азиз меҳмонлар!\nСизни юксак ҳурмат ва эҳтиром ила ${e.aboutCyrl}га таклиф этамиз. Ушбу қувончли кунимизда ташрифингиз биз учун алоҳида мамнуният бағишлайди. Қувончимизни баҳам кўришингизни сўраймиз. Ушбу тантанага ташрифингиз биз учун юксак эҳтиромдир.`,
        ru: `Дорогие гости!\nС глубоким уважением приглашаем Вас на ${e.aboutRu}. Ваш визит в этот радостный день будет для нас особой честью. Просим Вас разделить с нами нашу радость. Ваше присутствие на этом торжестве — для нас высокая честь.`,
      },
    },
    {
      id: "dua",
      title: { "uz-latn": "Duoli", "uz-cyrl": "Дуоли", ru: "С дуа" },
      text: {
        "uz-latn": `Aziz mehmonlar!\nSizni ${e.aboutLatn}ga samimiy taklif etamiz. Yaratgandan oilamizga baraka, mehr va saodat ato etishini so‘raymiz. Sizning duolaringiz va ezgu tilaklaringiz ushbu kunimizning eng qimmatli bezagi bo‘ladi. Quvonchimizga sherik bo‘lishingizni intizorlik bilan kutamiz.`,
        "uz-cyrl": `Азиз меҳмонлар!\nСизни ${e.aboutCyrl}га самимий таклиф этамиз. Яратгандан оиламизга барака, меҳр ва саодат ато этишини сўраймиз. Сизнинг дуоларингиз ва эзгу тилакларингиз ушбу кунимизнинг энг қимматли безаги бўлади. Қувончимизга шерик бўлишингизни интизорлик билан кутамиз.`,
        ru: `Дорогие гости!\nИскренне приглашаем Вас на ${e.aboutRu}. Просим Всевышнего даровать нашей семье благословение, любовь и благополучие. Ваши молитвы и добрые пожелания станут самым ценным украшением этого дня. С нетерпением ждём, что Вы разделите с нами нашу радость.`,
      },
    },
    {
      id: "minimal",
      title: {
        "uz-latn": "Qisqa va lo‘nda",
        "uz-cyrl": "Қисқа ва лўнда",
        ru: "Кратко",
      },
      text: {
        "uz-latn": `Aziz mehmonlar!\nSizni ${e.aboutLatn}ga taklif etamiz. Qadrli mehmonimiz sifatida tashrif buyurishingizdan mamnun bo‘lamiz. Quvonchli kunimizda Siz bilan birga bo‘lish biz uchun katta baxtdir. Tashrifingizni intizorlik bilan kutamiz.`,
        "uz-cyrl": `Азиз меҳмонлар!\nСизни ${e.aboutCyrl}га таклиф этамиз. Қадрли меҳмонимиз сифатида ташриф буюришингиздан мамнун бўламиз. Қувончли кунимизда Сиз билан бирга бўлиш биз учун катта бахтдир. Ташрифингизни интизорлик билан кутамиз.`,
        ru: `Дорогие гости!\nПриглашаем Вас на ${e.aboutRu}. Будем рады видеть Вас как дорогого гостя. Для нас большое счастье провести этот радостный день вместе с Вами. С нетерпением ждём Вашего визита.`,
      },
    },
    {
      id: "modern",
      title: {
        "uz-latn": "Zamonaviy",
        "uz-cyrl": "Замонавий",
        ru: "Современный",
      },
      text: {
        "uz-latn": `Aziz mehmonlar!\nSizning tashrifingiz ${e.latn}ni yanada go‘zal va fayzli qiladi. Keling, birgalikda unutilmas xotiralar yarataylik. Quvonchli kunimizni Siz bilan baham ko‘rishdan mamnun bo‘lamiz. Samimiy davra va quvonchli lahzalar Sizni kutmoqda.`,
        "uz-cyrl": `Азиз меҳмонлар!\nСизнинг ташрифингиз ${e.cyrl}ни янада гўзал ва файзли қилади. Келинг, биргаликда унутилмас хотиралар яратайлик. Қувончли кунимизни Сиз билан баҳам кўришдан мамнун бўламиз. Самимий давра ва қувончли лаҳзалар Сизни кутмоқда.`,
        ru: `Дорогие гости!\nВаш визит сделает ${e.ru} ещё прекраснее и теплее. Давайте вместе создадим незабываемые воспоминания. Будем рады разделить с Вами этот радостный день. Вас ждут тёплая компания и радостные мгновения.`,
      },
    },
    {
      id: "premium",
      title: {
        "uz-latn": "Premium variant",
        "uz-cyrl": "Премиум вариант",
        ru: "Премиум",
      },
      text: {
        "uz-latn": `Aziz va qadrli mehmonlar!\nSizni hayotimizdagi eng quvonchli kunlardan biri — ${e.aboutLatn}ga samimiy taklif etamiz. Ushbu qutlug‘ lahzalarda Sizning tashrifingiz biz uchun alohida ahamiyatga ega. Ezgu tilak va duolaringiz bilan quvonchimizga sherik bo‘lishingizni chin dildan istaymiz. Ushbu baxtiyor kunimizni Siz bilan birga nishonlash biz uchun katta sharaf va baxtdir.`,
        "uz-cyrl": `Азиз ва қадрли меҳмонлар!\nСизни ҳаётимиздаги энг қувончли кунлардан бири — ${e.aboutCyrl}га самимий таклиф этамиз. Ушбу қутлуғ лаҳзаларда Сизнинг ташрифингиз биз учун алоҳида аҳамиятга эга. Эзгу тилак ва дуоларингиз билан қувончимизга шерик бўлишингизни чин дилдан истаймиз. Ушбу бахтиёр кунимизни Сиз билан бирга нишонлаш биз учун катта шараф ва бахтдир.`,
        ru: `Дорогие и уважаемые гости!\nИскренне приглашаем Вас на один из самых радостных дней нашей жизни — ${e.aboutRu}. В эти благословенные мгновения Ваш визит имеет для нас особое значение. От всей души желаем, чтобы Вы разделили нашу радость добрыми пожеланиями и молитвами. Разделить с Вами этот счастливый день — для нас большая честь и радость.`,
      },
    },
  ];
}

export function buildLocalReadyTemplates(
  _t: (key: string, options?: Record<string, unknown>) => string,
  eventSlug: string,
  language: string,
): TextTemplate[] {
  return pack(eventSlug, language, eventDrafts(eventSlug));
}

export function mergeReadyTextTemplates(
  serverTemplates: TextTemplate[],
  localTemplates: TextTemplate[],
): TextTemplate[] {
  // Prefer admin/API templates; fill gaps from local catalog only.
  const seen = new Set<string>();
  const out: TextTemplate[] = [];
  const push = (tpl: TextTemplate) => {
    const key = `${tpl.title}`.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(tpl);
  };
  serverTemplates.forEach(push);
  localTemplates.forEach(push);
  return out;
}
