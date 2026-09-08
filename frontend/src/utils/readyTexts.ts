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
        "Assalomu alaykum!\nHurmat bilan Sizni nikoh to‘yimizga mehmon bo‘lishga chorlaymiz. Ikki oilaning quvonchi birlashadigan ushbu kunda Sizning ishtirokingiz biz uchun muhim. Marhamat qilib, tantanamizda mehmon bo‘ling.",
      "uz-cyrl":
        "Ассалому алайкум!\nҲурмат билан Сизни никоҳ тўйимизга меҳмон бўлишга чорлаймиз. Икки оиланинг қувончи бирлашадиган ушбу кунда Сизнинг иштирокингиз биз учун муҳим. Марҳамат қилиб, тантанамизда меҳмон бўлинг.",
      ru: "Ассаламу алейкум!\nС уважением приглашаем Вас на нашу свадьбу. В день, когда соединяется радость двух семей, Ваше присутствие для нас особенно важно. Пожалуйста, будьте нашим дорогим гостем.",
    },
  },
  {
    id: "warm1",
    title: { "uz-latn": "Samimiy 1", "uz-cyrl": "Самимий 1", ru: "Тёплое 1" },
    text: {
      "uz-latn":
        "Hurmatli mehmonimiz!\nYuragimizdagi eng iliqlik bilan Sizni oilaviy dasturxonimizga chorlaymiz. Kelib, tabassum va ezgu so‘zlaringiz bilan uyimizni to‘ldiring. Bu kunni Siz bilan o‘tkazish — eng katta baxtimiz.",
      "uz-cyrl":
        "Ҳурматли меҳмонимиз!\nЮрагимиздаги энг илиқлик билан Сизни оилавий дастурхонимизга чорлаймиз. Келиб, табассум ва эзгу сўзларингиз билан уйимизни тўлдиринг. Бу кунни Сиз билан ўтказиш — энг катта бахтимиз.",
      ru: "Уважаемый гость!\nОт всего сердца зовём Вас за наш семейный дастархан. Приходите и наполните наш дом улыбкой и добрыми словами. Провести этот день с Вами — наше большое счастье.",
    },
  },
  {
    id: "classic2",
    title: { "uz-latn": "Klassik 2", "uz-cyrl": "Классик 2", ru: "Классика 2" },
    text: {
      "uz-latn":
        "Aziz mehmonlar!\nHayotimizda yangi sahifa ochilmoqda — nikoh rishtasi. Shu munosabat bilan Sizni tantanaga taklif etamiz. Mehmonlarimiz safida Sizni ko‘rish — oilamiz uchun alohida mamnuniyat.",
      "uz-cyrl":
        "Азиз меҳмонлар!\nҲаётимизда янги саҳифа очилмоқда — никоҳ риштаси. Шу муносабат билан Сизни тантанага таклиф этамиз. Меҳмонларимиз сафида Сизни кўриш — оиламиз учун алоҳида мамнуният.",
      ru: "Дорогие гости!\nВ нашей жизни открывается новая страница — брачный союз. По этому случаю приглашаем Вас на торжество. Видеть Вас среди гостей — особая радость для нашей семьи.",
    },
  },
  {
    id: "warm2",
    title: { "uz-latn": "Samimiy 2", "uz-cyrl": "Самимий 2", ru: "Тёплое 2" },
    text: {
      "uz-latn":
        "Aziz do‘stlar!\nTo‘y kechasida Sizning ovozingiz, kulguingiz va samimiy tilaklaringiz bo‘lsin. Kelib, yosh oilani quvontiring — har bir mehmon biz uchun qadrli. Intizorlik bilan kutamiz!",
      "uz-cyrl":
        "Азиз дўстлар!\nТўй кечасида Сизнинг овозингиз, кулгуингиз ва самимий тилакларингиз бўлсин. Келиб, ёш оилани қувонтирнг — ҳар бир меҳмон биз учун қадрли. Интизорлик билан кутамиз!",
      ru: "Дорогие друзья!\nПусть на свадебном вечере звучат Ваш голос, смех и искренние пожелания. Приходите порадовать молодую семью — каждый гость для нас дорог. С нетерпением ждём!",
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
        "Hurmatli mehmonlar!\nYuqori ehtirom bilan Sizni nikoh marosimiga taklif etamiz. Ikki qalbning rasmiy birlashuviga guvoh bo‘lishingizni so‘raymiz. Tashrifingiz oilamiz uchun yuksak izzatdir.",
      "uz-cyrl":
        "Ҳурматли меҳмонлар!\nЮқори эҳтиром билан Сизни никоҳ маросимига таклиф этамиз. Икки қалбнинг расмий бирлашувига гувоҳ бўлишингизни сўраймиз. Ташрифингиз оиламиз учун юксак иззатдир.",
      ru: "Уважаемые гости!\nС глубоким почтением приглашаем Вас на свадебную церемонию. Просим стать свидетелями официального соединения двух сердец. Ваш визит — высокая честь для нашей семьи.",
    },
  },
  {
    id: "dua",
    title: { "uz-latn": "Duoli", "uz-cyrl": "Дуоли", ru: "С дуа" },
    text: {
      "uz-latn":
        "Bismillahir rohmanir rohiym.\nNikoh to‘yimizda Allohdan oilamizga baraka, sabr va mehr so‘raymiz. Sizning duolarigiz — shu kunning eng ulug‘ sovg‘asi. Kelib, ezgu tilaklaringiz bilan birga bo‘ling.",
      "uz-cyrl":
        "Бисмиллаҳир роҳманир роҳийм.\nНикоҳ тўйимизда Аллоҳдан оиламизга барака, сабр ва меҳр сўраймиз. Сизнинг дуоларингиз — шу куннинг энг улуғ совғаси. Келиб, эзгу тилакларингиз билан бирга бўлинг.",
      ru: "Бисмилляхи р-рахмани р-рахим.\nНа нашей свадьбе просим у Всевышнего благословения, терпения и любви для семьи. Ваши молитвы — самый великий дар этого дня. Приходите вместе с добрыми пожеланиями.",
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
        "Aziz mehmonlar!\nNikoh to‘yimizga taklif etamiz. Kutamiz!",
      "uz-cyrl":
        "Азиз меҳмонлар!\nНикоҳ тўйимизга таклиф этамиз. Кутамиз!",
      ru: "Дорогие гости!\nПриглашаем Вас на свадьбу. Ждём!",
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
        "Salom!\nBizning love storymizning eng muhim kechasi — va Siz unda bo‘lishingizni xohlaymiz. Kelib, birga kulaylik, suratga tushaylik va unutilmas xotiralar qoldiraylik.",
      "uz-cyrl":
        "Салом!\nБизнинг love storyмизнинг энг муҳим кечаси — ва Сиз унда бўлишингизни хоҳлаймиз. Келиб, бирга кулайлик, суратга тушайлик ва унутилмас хотиралар қолдирайлик.",
      ru: "Привет!\nСамый важный вечер нашей истории любви — и мы хотим, чтобы Вы были с нами. Приходите: посмеёмся, сделаем фото и оставим незабываемые воспоминания.",
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
        "Aziz va qadrli mehmonlar!\nOilalarimizning eng sharafli kuni — nikoh rishtasining mustahkamlanishi. Shu tantanada Sizning ishtirokingiz biz uchun nafaqat sharaf, balki baxtning to‘liqligidir. Ezgu niyatlaringiz bilan kelib, yosh juftlikka mehr bag‘ishlang. Ushbu kechani Siz bilan birga nishonlash — eng ulug‘ izzatimiz.",
      "uz-cyrl":
        "Азиз ва қадрли меҳмонлар!\nОилаларимизнинг энг шарафли куни — никоҳ риштасининг мустаҳкамланиши. Шу тантанада Сизнинг иштирокингиз биз учун нафақат шараф, балки бахтнинг тўлиқлигидир. Эзгу ниятларингиз билан келиб, ёш жуфтликка меҳр бағишланг. Ушбу кечани Сиз билан бирга нишонлаш — энг улуғ иззатимиз.",
      ru: "Дорогие и уважаемые гости!\nСамый почётный день наших семей — укрепление брачного союза. Ваше присутствие на этом торжестве для нас не только честь, но и полнота счастья. Приходите с добрыми намерениями и подарите молодой паре своё тепло. Разделить этот вечер с Вами — наша величайшая честь.",
    },
  },
];

function eventDrafts(slug: string): Draft[] {
  if (slug === "nikoh") return NIKOH;

  const topic: Record<
    string,
    {
      latn: string;
      cyrl: string;
      ru: string;
      aboutLatn: string;
      aboutCyrl: string;
      aboutRu: string;
      warmLatn: string;
      warmCyrl: string;
      warmRu: string;
      duaLatn: string;
      duaCyrl: string;
      duaRu: string;
    }
  > = {
    aqiqa: {
      latn: "aqiqa marosimi",
      cyrl: "ақиқа маросими",
      ru: "акику",
      aboutLatn: "farzandimiz aqiqa marosimi",
      aboutCyrl: "фарзандимиз ақиқа маросими",
      aboutRu: "акики нашего ребёнка",
      warmLatn: "kichik farzandimiz sharafiga uyushtirilgan aqiqa",
      warmCyrl: "кичик фарзандимиз шарафига уюштирилган ақиқа",
      warmRu: "акику в честь нашего малыша",
      duaLatn: "farzandimizga sihat-salomatlik va baraka",
      duaCyrl: "фарзандимизга сиҳат-саломатлик ва барака",
      duaRu: "здоровья и благословения нашему ребёнку",
    },
    sunnat: {
      latn: "sunnat to‘yi",
      cyrl: "суннат тўйи",
      ru: "суннат той",
      aboutLatn: "o‘g‘limizning sunnat to‘yi",
      aboutCyrl: "ўғлимизнинг суннат тўйи",
      aboutRu: "суннат тоя нашего сына",
      warmLatn: "o‘g‘limiz uchun sunnat to‘yi",
      warmCyrl: "ўғлимиз учун суннат тўйи",
      warmRu: "суннат той для нашего сына",
      duaLatn: "o‘g‘limizga baxt, salomatlik va to‘g‘ri yo‘l",
      duaCyrl: "ўғлимизга бахт, саломатлик ва тўғри йўл",
      duaRu: "счастья, здоровья и верного пути нашему сыну",
    },
    birthday: {
      latn: "tug‘ilgan kun bayrami",
      cyrl: "туғилган кун байрами",
      ru: "день рождения",
      aboutLatn: "tug‘ilgan kun bayramimiz",
      aboutCyrl: "туғилган кун байрамимиз",
      aboutRu: "день рождения",
      warmLatn: "yubiley kayfiyatidagi tug‘ilgan kun",
      warmCyrl: "юбилей кайфиятидаги туғилган кун",
      warmRu: "день рождения в праздничном настроении",
      duaLatn: "umrga baraka, baxt va omad",
      duaCyrl: "умрга барака, бахт ва омад",
      duaRu: "долгих лет, счастья и удачи",
    },
    hudoyi: {
      latn: "hudoyi dasturxoni",
      cyrl: "худойи дастурхони",
      ru: "худое",
      aboutLatn: "hudoyi dasturxonimiz",
      aboutCyrl: "худойи дастурхонимиз",
      aboutRu: "худое",
      warmLatn: "shukronalik uchun hudoyi dasturxon",
      warmCyrl: "шукроналик учун худойи дастурхон",
      warmRu: "дастархан худои в знак благодарности",
      duaLatn: "oilamizga tinchlik, baraka va rahmat",
      duaCyrl: "оиламизга тинчлик, барака ва раҳмат",
      duaRu: "миру, благословению и милости для нашей семьи",
    },
    hayit: {
      latn: "{hayit_occasion} ziyofati",
      cyrl: "{hayit_occasion} зиёфати",
      ru: "{hayit_occasion}",
      aboutLatn: "{hayit_occasion} ziyofatimiz",
      aboutCyrl: "{hayit_occasion} зиёфатимиз",
      aboutRu: "{hayit_occasion}",
      warmLatn: "hayit munosabati bilan oilaviy dasturxon",
      warmCyrl: "ҳайт муносабати билан оилавий дастурхон",
      warmRu: "семейный дастархан по случаю хаита",
      duaLatn: "hayit barakasi va oilaviy tinchlik",
      duaCyrl: "ҳайт баракаси ва оилавий тинчлик",
      duaRu: "благословения хаита и семейного мира",
    },
  };

  const e = topic[slug] || {
    latn: "tadbirimiz",
    cyrl: "тадбиримиз",
    ru: "наше торжество",
    aboutLatn: "tadbirimiz",
    aboutCyrl: "тадбиримиз",
    aboutRu: "наше торжество",
    warmLatn: "oilaviy tadbirimiz",
    warmCyrl: "оилавий тадбиримиз",
    warmRu: "наше семейное торжество",
    duaLatn: "oilamizga baraka va tinchlik",
    duaCyrl: "оиламизга барака ва тинчлик",
    duaRu: "благословения и мира нашей семье",
  };

  return [
    {
      id: "classic1",
      title: { "uz-latn": "Klassik 1", "uz-cyrl": "Классик 1", ru: "Классика 1" },
      text: {
        "uz-latn": `Assalomu alaykum!\nHurmat bilan Sizni ${e.aboutLatn}ga mehmon bo‘lishga chorlaymiz. Ushbu kunda Sizning ishtirokingiz oilamiz uchun muhim. Marhamat qilib, tantanamizda bo‘ling.`,
        "uz-cyrl": `Ассалому алайкум!\nҲурмат билан Сизни ${e.aboutCyrl}га меҳмон бўлишга чорлаймиз. Ушбу кунда Сизнинг иштирокингиз оиламиз учун муҳим. Марҳамат қилиб, тантанамизда бўлинг.`,
        ru: `Ассаламу алейкум!\nС уважением приглашаем Вас на ${e.aboutRu}. Ваше присутствие в этот день важно для нашей семьи. Пожалуйста, будьте нашим гостем.`,
      },
    },
    {
      id: "warm1",
      title: { "uz-latn": "Samimiy 1", "uz-cyrl": "Самимий 1", ru: "Тёплое 1" },
      text: {
        "uz-latn": `Hurmatli mehmonimiz!\nChin dildan Sizni ${e.warmLatn}ga chorlaymiz. Kelib, tabassum va ezgu so‘zlaringiz bilan davramizni to‘ldiring. Bu kunni Siz bilan o‘tkazish — eng katta baxtimiz.`,
        "uz-cyrl": `Ҳурматли меҳмонимиз!\nЧин дилдан Сизни ${e.warmCyrl}га чорлаймиз. Келиб, табассум ва эзгу сўзларингиз билан даврамизни тўлдиринг. Бу кунни Сиз билан ўтказиш — энг катта бахтимиз.`,
        ru: `Уважаемый гость!\nОт всей души зовём Вас на ${e.warmRu}. Приходите и наполните наш круг улыбкой и добрыми словами. Провести этот день с Вами — наше большое счастье.`,
      },
    },
    {
      id: "classic2",
      title: { "uz-latn": "Klassik 2", "uz-cyrl": "Классик 2", ru: "Классика 2" },
      text: {
        "uz-latn": `Aziz mehmonlar!\nOilamizdagi muhim kun — ${e.aboutLatn}. Shu munosabat bilan Sizni tantanaga taklif etamiz. Mehmonlarimiz safida Sizni ko‘rishdan mamnun bo‘lamiz.`,
        "uz-cyrl": `Азиз меҳмонлар!\nОиламиздаги муҳим кун — ${e.aboutCyrl}. Шу муносабат билан Сизни тантанага таклиф этамиз. Меҳмонларимиз сафида Сизни кўришдан мамнун бўламиз.`,
        ru: `Дорогие гости!\nВажный день нашей семьи — ${e.aboutRu}. По этому случаю приглашаем Вас на торжество. Будем рады видеть Вас среди гостей.`,
      },
    },
    {
      id: "warm2",
      title: { "uz-latn": "Samimiy 2", "uz-cyrl": "Самимий 2", ru: "Тёплое 2" },
      text: {
        "uz-latn": `Aziz do‘stlar!\n${e.latn[0].toUpperCase()}${e.latn.slice(1)}da Sizning ovozingiz va samimiy tilaklaringiz bo‘lsin. Kelib, oilaviy quvonchimizni bo‘lishing — har bir mehmon biz uchun qadrli.`,
        "uz-cyrl": `Азиз дўстлар!\n${e.cyrl[0].toUpperCase()}${e.cyrl.slice(1)}да Сизнинг овозингиз ва самимий тилакларингиз бўлсин. Келиб, оилавий қувончимизни бўлинг — ҳар бир меҳмон биз учун қадрли.`,
        ru: `Дорогие друзья!\nПусть на ${e.ru} звучат Ваш голос и искренние пожелания. Приходите разделить семейную радость — каждый гость для нас дорог.`,
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
        "uz-latn": `Hurmatli mehmonlar!\nYuqori ehtirom bilan Sizni ${e.aboutLatn}ga taklif etamiz. Tashrifingiz oilamiz uchun yuksak izzatdir. Marhamat qilib, tantanamizda ishtirok eting.`,
        "uz-cyrl": `Ҳурматли меҳмонлар!\nЮқори эҳтиром билан Сизни ${e.aboutCyrl}га таклиф этамиз. Ташрифингиз оиламиз учун юксак иззатдир. Марҳамат қилиб, тантанамизда иштирок этинг.`,
        ru: `Уважаемые гости!\nС глубоким почтением приглашаем Вас на ${e.aboutRu}. Ваш визит — высокая честь для нашей семьи. Просим принять участие в торжестве.`,
      },
    },
    {
      id: "dua",
      title: { "uz-latn": "Duoli", "uz-cyrl": "Дуоли", ru: "С дуа" },
      text: {
        "uz-latn": `Bismillahir rohmanir rohiym.\n${e.aboutLatn[0].toUpperCase()}${e.aboutLatn.slice(1)}da Allohdan ${e.duaLatn} so‘raymiz. Sizning duolarigiz — shu kunning eng ulug‘ sovg‘asi. Kelib, ezgu tilaklaringiz bilan birga bo‘ling.`,
        "uz-cyrl": `Бисмиллаҳир роҳманир роҳийм.\n${e.aboutCyrl[0].toUpperCase()}${e.aboutCyrl.slice(1)}да Аллоҳдан ${e.duaCyrl} сўраймиз. Сизнинг дуоларингиз — шу куннинг энг улуғ совғаси. Келиб, эзгу тилакларингиз билан бирга бўлинг.`,
        ru: `Бисмилляхи р-рахмани р-рахим.\nНа ${e.aboutRu} просим у Всевышнего ${e.duaRu}. Ваши молитвы — самый великий дар этого дня. Приходите вместе с добрыми пожеланиями.`,
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
        "uz-latn": `Aziz mehmonlar!\n${e.aboutLatn[0].toUpperCase()}${e.aboutLatn.slice(1)}ga taklif etamiz. Kutamiz!`,
        "uz-cyrl": `Азиз меҳмонлар!\n${e.aboutCyrl[0].toUpperCase()}${e.aboutCyrl.slice(1)}га таклиф этамиз. Кутамиз!`,
        ru: `Дорогие гости!\nПриглашаем Вас на ${e.aboutRu}. Ждём!`,
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
        "uz-latn": `Salom!\n${e.latn[0].toUpperCase()}${e.latn.slice(1)} — va Siz unda bo‘lishingizni xohlaymiz. Kelib, birga kulaylik, suratga tushaylik va yaxshi kayfiyat ulashaylik.`,
        "uz-cyrl": `Салом!\n${e.cyrl[0].toUpperCase()}${e.cyrl.slice(1)} — ва Сиз унда бўлишингизни хоҳлаймиз. Келиб, бирга кулайлик, суратга тушайлик ва яхши кайфият улашайлик.`,
        ru: `Привет!\n${e.ru[0].toUpperCase()}${e.ru.slice(1)} — и мы хотим, чтобы Вы были с нами. Приходите: посмеёмся, сделаем фото и поделимся хорошим настроением.`,
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
        "uz-latn": `Aziz va qadrli mehmonlar!\nOilamizning eng muhim kunlaridan biri — ${e.aboutLatn}. Shu tantanada Sizning ishtirokingiz biz uchun sharaf va baxtning to‘liqligidir. Ezgu niyatlaringiz bilan kelib, oilaviy quvonchimizga mehr bag‘ishlang.`,
        "uz-cyrl": `Азиз ва қадрли меҳмонлар!\nОиламизнинг энг муҳим кунларидан бири — ${e.aboutCyrl}. Шу тантанада Сизнинг иштирокингиз биз учун шараф ва бахтнинг тўлиқлигидир. Эзгу ниятларингиз билан келиб, оилавий қувончимизга меҳр бағишланг.`,
        ru: `Дорогие и уважаемые гости!\nОдин из самых важных дней нашей семьи — ${e.aboutRu}. Ваше присутствие на этом торжестве для нас честь и полнота счастья. Приходите с добрыми намерениями и подарите тепло нашей семейной радости.`,
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
  // Prefer diversified local catalog; keep uniquely titled admin/API templates.
  const seen = new Set<string>();
  const out: TextTemplate[] = [];
  const push = (tpl: TextTemplate) => {
    const key = `${tpl.title}`.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(tpl);
  };
  localTemplates.forEach(push);
  serverTemplates.forEach(push);
  return out;
}
