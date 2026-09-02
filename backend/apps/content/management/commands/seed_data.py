from pathlib import Path
from shutil import copy2
import re

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.content.models import AIPromptPreset, EventConfig, MoodTag, Template, TextTemplate
from apps.content.template_assets import (
    EVENT_TEMPLATE_PICKS,
    build_all,
    design_meta,
)
from apps.users.models import Role, User


ASSETS_DIR = Path(__file__).resolve().parents[2] / "assets" / "templates"


def _ensure_media_templates() -> None:
    """Build distinct event templates and sync into MEDIA_ROOT."""
    media = Path(settings.MEDIA_ROOT) / "templates"
    build_all(ASSETS_DIR, media)
    if not ASSETS_DIR.is_dir():
        return
    media.mkdir(parents=True, exist_ok=True)
    for src in ASSETS_DIR.glob("*.jpg"):
        target = media / src.name
        if not target.exists() or src.stat().st_mtime > target.stat().st_mtime:
            copy2(src, target)


EVENTS = [
    {
        "slug": "nikoh",
        "sort_order": 1,
        "name_translations": {
            "uz-cyrl": "Никоҳ",
            "uz-latn": "Nikoh",
            "ru": "Никах",
        },
        "subtypes": [
            {
                "slug": "nikoh_oqshomi",
                "names": {
                    "uz-cyrl": "Никоҳ оқшоми",
                    "uz-latn": "Nikoh oqshomi",
                    "ru": "Свадебный вечер",
                },
            },
            {
                "slug": "nahorgi_osh",
                "names": {
                    "uz-cyrl": "Наҳорга ош",
                    "uz-latn": "Nahorga osh",
                    "ru": "Утренний плов",
                },
            },
            {
                "slug": "maslahat_oshi",
                "names": {
                    "uz-cyrl": "Маслаҳат оши",
                    "uz-latn": "Maslahat oshi",
                    "ru": "Плов-маслахат",
                },
            },
            {
                "slug": "qiz_bazmi",
                "names": {
                    "uz-cyrl": "Қиз базми",
                    "uz-latn": "Qiz bazmi",
                    "ru": "Девичий вечер",
                },
            },
        ],
        "fields_schema": {
            "subtype_mode": "multi",
            "required": [
                {"key": "event_date", "type": "date", "min": "today"},
                {"key": "event_time", "type": "time"},
                {"key": "venue_name", "type": "string", "maxLength": 100},
                {"key": "venue_address", "type": "string", "maxLength": 200},
            ],
            "optional": [
                {"key": "personal_message", "type": "text", "maxLength": 200},
            ],
        },
    },
    {
        "slug": "aqiqa",
        "sort_order": 2,
        "name_translations": {
            "uz-cyrl": "Ақиқа",
            "uz-latn": "Aqiqa",
            "ru": "Акика",
        },
        "subtypes": [],
        "fields_schema": {
            "required": [
                {"key": "child_gender", "type": "enum", "options": ["boy", "girl"]},
                {"key": "event_date", "type": "date", "min": "today"},
                {"key": "event_time", "type": "time"},
                {"key": "venue_name", "type": "string", "maxLength": 100},
                {"key": "venue_address", "type": "string", "maxLength": 200},
            ],
            "optional": [
                {"key": "child_name", "type": "string", "maxLength": 50},
                {"key": "personal_message", "type": "text", "maxLength": 200},
            ],
        },
    },
    {
        "slug": "sunnat",
        "sort_order": 3,
        "name_translations": {
            "uz-cyrl": "Суннат тўйи",
            "uz-latn": "Sunnat toʻyi",
            "ru": "Суннат той",
        },
        "fields_schema": {
            "required": [
                {"key": "child_name", "type": "string", "maxLength": 50},
                {"key": "event_date", "type": "date", "min": "today"},
                {"key": "event_time", "type": "time"},
                {"key": "venue_name", "type": "string", "maxLength": 100},
                {"key": "venue_address", "type": "string", "maxLength": 200},
            ],
            "optional": [],
        },
    },
    {
        "slug": "birthday",
        "sort_order": 4,
        "name_translations": {
            "uz-cyrl": "Туғилган кун",
            "uz-latn": "Tugʻilgan kun",
            "ru": "День рождения",
        },
        "fields_schema": {
            "required": [
                {"key": "person_name", "type": "string", "maxLength": 50},
                {"key": "event_date", "type": "date", "min": "today"},
                {"key": "event_time", "type": "time"},
                {"key": "venue_name", "type": "string", "maxLength": 100},
                {"key": "venue_address", "type": "string", "maxLength": 200},
            ],
            "optional": [{"key": "personal_message", "type": "text", "maxLength": 200}],
        },
    },
    {
        "slug": "hudoyi",
        "sort_order": 5,
        "name_translations": {
            "uz-cyrl": "Худойи",
            "uz-latn": "Hudoyi",
            "ru": "Худои",
        },
        "fields_schema": {
            "required": [
                {"key": "event_date", "type": "date", "min": "today"},
                {"key": "event_time", "type": "time"},
                {"key": "venue_name", "type": "string", "maxLength": 100},
                {"key": "venue_address", "type": "string", "maxLength": 200},
            ],
            "optional": [],
        },
    },
    {
        "slug": "hayit",
        "sort_order": 6,
        "name_translations": {
            "uz-cyrl": "Ҳайт",
            "uz-latn": "Hayit",
            "ru": "Хаит",
        },
        "subtypes": [
            {
                "slug": "ramazon_hayiti",
                "names": {
                    "uz-cyrl": "Рамазон ҳайти",
                    "uz-latn": "Ramazon hayiti",
                    "ru": "Рамазан-хаит",
                },
            },
            {
                "slug": "qurbon_hayiti",
                "names": {
                    "uz-cyrl": "Қурбон ҳайти",
                    "uz-latn": "Qurbon hayiti",
                    "ru": "Курбан-хаит",
                },
            },
        ],
        "fields_schema": {
            "subtype_mode": "single",
            "required": [
                {"key": "venue_name", "type": "string", "maxLength": 100},
                {"key": "venue_address", "type": "string", "maxLength": 200},
            ],
            "optional": [],
        },
        "is_active": False,
    },
]

MOOD_TAGS = [
    (
        "rose_gold",
        "color",
        "soft rose-gold metallic double frame and warm blush highlights like premium pink stationery",
        {"uz-cyrl": "Атиргул олтин", "uz-latn": "Atirgul oltin", "ru": "Розовое золото"},
    ),
    (
        "emerald",
        "color",
        "deep forest-green typography on cream paper with gold accents — no mixed icon badge rows",
        {"uz-cyrl": "Зумрад", "uz-latn": "Zumrad", "ru": "Изумруд"},
    ),
    (
        "ivory",
        "color",
        "warm cream ivory textured paper ground with soft parchment feel",
        {"uz-cyrl": "Филсуяк", "uz-latn": "Filsuyak", "ru": "Слоновая кость"},
    ),
    (
        "peonies",
        "flowers",
        "detailed cream-yellow roses and green-gold leaves framing the four corners without covering text",
        {"uz-cyrl": "Пионлар", "uz-latn": "Pionlar", "ru": "Пионы"},
    ),
    (
        "fine_line",
        "flowers",
        "delicate fine-line rose and foliage illustrations overlapping a thin metallic frame",
        {"uz-cyrl": "Ингичка чизиқ", "uz-latn": "Ingichka chiziq", "ru": "Тонкая графика"},
    ),
    (
        "ornament",
        "style",
        "thin gold rectangular frame with small gold flourishes and heart dividers between sections",
        {"uz-cyrl": "Нақш", "uz-latn": "Naqsh", "ru": "Орнамент"},
    ),
    (
        "event_rows",
        "style",
        "stacked horizontal ceremony rows with subtle matching dividers — not mixed sticker icons",
        {"uz-cyrl": "Тадбир қаторлари", "uz-latn": "Tadbir qatorlari", "ru": "Ряды событий"},
    ),
    (
        "minimalist",
        "style",
        "clean minimalist luxury with lots of white/blush space and centered typography",
        {"uz-cyrl": "Минимализм", "uz-latn": "Minimalizm", "ru": "Минимализм"},
    ),
    (
        "velvet",
        "texture",
        "soft matte paper depth with subtle grain, premium print stationery feel",
        {"uz-cyrl": "Бархат", "uz-latn": "Barxat", "ru": "Бархат"},
    ),
    (
        "silk",
        "texture",
        "silk texture, smooth elegant fabric folds, premium finish",
        {"uz-cyrl": "Ипак", "uz-latn": "Ipak", "ru": "Шелк"},
    ),
    (
        "marble",
        "texture",
        "soft marble texture, subtle veins, refined luxury mood",
        {"uz-cyrl": "Мармар", "uz-latn": "Marmar", "ru": "Мрамор"},
    ),
    (
        "watercolor",
        "texture",
        "watercolor paper texture, airy brush gradients, delicate romantic style",
        {"uz-cyrl": "Акварел қоғоз", "uz-latn": "Akvarel qog‘oz", "ru": "Акварельная бумага"},
    ),
    (
        "linen",
        "texture",
        "fine linen texture, natural weave, warm and minimal aesthetic",
        {"uz-cyrl": "Зиғир мато", "uz-latn": "Zig‘ir mato", "ru": "Лен"},
    ),
    (
        "pearlescent",
        "texture",
        "pearlescent shimmer texture, soft glow, festive premium invitation look",
        {"uz-cyrl": "Марварид жилоси", "uz-latn": "Marvarid jilosi", "ru": "Перламутр"},
    ),
    (
        "handmade",
        "texture",
        "handmade paper grain texture, artisan look, subtle vintage elegance",
        {"uz-cyrl": "Ҳандмейд қоғоз", "uz-latn": "Handmade qog‘oz", "ru": "Ручная бумага"},
    ),
]

READY_TEXTS_PATH = Path(__file__).resolve().parents[2] / "data" / "ready_texts.json"


def _load_ready_texts() -> dict:
    if not READY_TEXTS_PATH.is_file():
        return {}
    import json

    try:
        return json.loads(READY_TEXTS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


# Local media paths served by Django at /media/...
# Each event gets its own 3 JPG templates (featured card is unique in gallery "all").

EVENT_COMPOSITION = {
    "nikoh": (
        "Wedding nikoh invitation. Matching corner florals, one elegant frame, "
        "calm open center. No mixed circular icon sticker rows. "
        "Compose a fresh card for the provided text."
    ),
    "aqiqa": (
        "Aqiqa baby celebration: airy centered typography, bold date line. "
        "Gentle, tender mood — not wedding formal. Compose a fresh card for the provided text."
    ),
    "sunnat": (
        "Sunnat toy for a boy: dignified serif hierarchy, one gold frame, "
        "matching corner ornaments only. At most one crest motif — never a sticker pack "
        "of mosque/drum/mandala icons. Avoid blush pink romance. "
        "Compose a fresh card for the provided text."
    ),
    "birthday": (
        "Birthday celebration: joyful party mood — not religious ceremony styling. "
        "Compose a fresh card for the provided text."
    ),
    "hudoyi": (
        "Hudoyi gratitude meal: humble centered typography, peaceful spiritual tone — "
        "no loud party confetti. Compose a fresh card for the provided text."
    ),
    "hayit": (
        "Hayit holiday gathering: celebratory but elegant Eid/holiday feast mood. "
        "Compose a fresh card for the provided text."
    ),
}


def _templates_for_event(event_slug: str) -> list[dict]:
    event_comp = EVENT_COMPOSITION.get(
        event_slug,
        "Premium Uzbek celebration invitation. Compose a fresh card for the provided text.",
    )
    picks = EVENT_TEMPLATE_PICKS.get(event_slug) or EVENT_TEMPLATE_PICKS["nikoh"]
    out: list[dict] = []
    for key, theme_name, tags in picks:
        meta = design_meta(key)
        out.append(
            {
                "theme_name": theme_name,
                "bg_url": f"/media/templates/{event_slug}_{key}.jpg",
                "bg_url_preview": f"/media/templates/{event_slug}_{key}_preview.jpg",
                "palette": meta["palette"],
                "tags": tags,
                "composition": (
                    f"Visual style: {meta['look']}. Event: {event_slug}. {event_comp}"
                ),
            }
        )
    return out


TEMPLATE_ASSETS = {slug: _templates_for_event(slug) for slug in EVENT_COMPOSITION}

KEEP_THEME_NAMES = {
    theme for picks in EVENT_TEMPLATE_PICKS.values() for _key, theme, _tags in picks
}


TEXT_BY_EVENT = {
    "nikoh": {
        "uz-latn": [
            {
                "title": "Klassik",
                "preview": (
                    "Assalomu alaykum!\n"
                    "Aziz mehmonimiz, Sizni nikoh toʻyimizga taklif etamiz. "
                    "Baxtli kunimizni Siz bilan birga nishonlash biz uchun katta sharaf.\n"
                    "{event_date}, soat {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Samimiy",
                "preview": (
                    "Hurmatli mehmonimiz!\n"
                    "Oilamizning eng quvonchli kuni — nikoh marosimimizga "
                    "Sizni chin dildan taklif qilamiz. Kelib, duo-fotihangizni ayting.\n"
                    "{event_date}, soat {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "uz-cyrl": [
            {
                "title": "Классик",
                "preview": (
                    "Ассалому алайкум!\n"
                    "Азиз меҳмонимиз, Сизни никоҳ тўйимизга таклиф этамиз. "
                    "Бахтли кунимизни Сиз билан бирга нишонлаш биз учун катта шараф.\n"
                    "{event_date}, соат {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Самимий",
                "preview": (
                    "Ҳурматли меҳмонимиз!\n"
                    "Оиламизнинг энг қувончли куни — никоҳ маросимимизга "
                    "Сизни чин дилдан таклиф қиламиз. Келиб, дуо-фотиҳангизни айтинг.\n"
                    "{event_date}, соат {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "ru": [
            {
                "title": "Классика",
                "preview": (
                    "Ассаламу алейкум!\n"
                    "Дорогой гость, приглашаем Вас на нашу свадьбу — никах. "
                    "Будем рады разделить с Вами этот счастливый день.\n"
                    "{event_date}, в {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Тёплое",
                "preview": (
                    "Уважаемый гость!\n"
                    "Сердечно приглашаем Вас на торжество никаха нашей семьи. "
                    "Ваше присутствие и добрые пожелания будут нам очень дороги.\n"
                    "{event_date}, в {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
    },
    "aqiqa": {
        "uz-latn": [
            {
                "title": "Klassik",
                "preview": (
                    "Assalomu alaykum!\n"
                    "Farzandimiz {child_name} ning aqiqa marosimi munosabati bilan "
                    "Sizni mehmon boʻlishga taklif etamiz. "
                    "Yangi hayot quvonchini Siz bilan baham koʻramiz.\n"
                    "{event_date}, soat {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Samimiy",
                "preview": (
                    "Hurmatli mehmonimiz!\n"
                    "Oilaimizga Alloh ato etgan farzand {child_name} uchun aqiqa dasturxoniga "
                    "Sizni chin yurakdan chorlaymiz. Duoingizni ayamang.\n"
                    "{event_date}, soat {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "uz-cyrl": [
            {
                "title": "Классик",
                "preview": (
                    "Ассалому алайкум!\n"
                    "Фарзандимиз {child_name} нинг ақиқа маросими муносабати билан "
                    "Сизни меҳмон бўлишга таклиф этамиз. "
                    "Янги ҳаёт қувончини Сиз билан баҳам кўрамиз.\n"
                    "{event_date}, соат {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Самимий",
                "preview": (
                    "Ҳурматли меҳмонимиз!\n"
                    "Оиламизга Аллоҳ ато этган фарзанд {child_name} учун ақиқа дастурхонига "
                    "Сизни чин юракдан чорлаймиз. Дуоингизни аяманг.\n"
                    "{event_date}, соат {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "ru": [
            {
                "title": "Классика",
                "preview": (
                    "Ассаламу алейкум!\n"
                    "По случаю акики нашего ребёнка {child_name} приглашаем Вас в гости. "
                    "Разделите с нами радость появления новой жизни.\n"
                    "{event_date}, в {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Тёплое",
                "preview": (
                    "Уважаемый гость!\n"
                    "От всего сердца приглашаем Вас на дастархан акики {child_name} — "
                    "благодарность Всевышнему за дарованного нам ребёнка.\n"
                    "{event_date}, в {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
    },
    "sunnat": {
        "uz-latn": [
            {
                "title": "Klassik",
                "preview": (
                    "Assalomu alaykum!\n"
                    "Oʻgʻlimiz {child_name} ning sunnat toʻyi munosabati bilan "
                    "Sizni tantanamizga taklif etamiz. "
                    "Marosimimizni sharaflab, duo-fotihangizni ayting.\n"
                    "{event_date}, soat {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Samimiy",
                "preview": (
                    "Hurmatli mehmonimiz!\n"
                    "Farzandimiz {child_name} uchun sunnat toʻyi dasturxoniga "
                    "Sizni samimiy taklif qilamiz. Kelib, quvonchimizga sherik boʻling.\n"
                    "{event_date}, soat {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "uz-cyrl": [
            {
                "title": "Классик",
                "preview": (
                    "Ассалому алайкум!\n"
                    "Ўғлимиз {child_name} нинг суннат тўйи муносабати билан "
                    "Сизни тантанамизга таклиф этамиз. "
                    "Маросимимизни шарафлаб, дуо-фотиҳангизни айтинг.\n"
                    "{event_date}, соат {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Самимий",
                "preview": (
                    "Ҳурматли меҳмонимиз!\n"
                    "Фарзандимиз {child_name} учун суннат тўйи дастурхонига "
                    "Сизни самимий таклиф қиламиз. Келиб, қувончимизга шерик бўлинг.\n"
                    "{event_date}, соат {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "ru": [
            {
                "title": "Классика",
                "preview": (
                    "Ассаламу алейкум!\n"
                    "По случаю суннат тоя нашего сына {child_name} приглашаем Вас на торжество. "
                    "Окажите честь своим присутствием и добрым пожеланием.\n"
                    "{event_date}, в {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Тёплое",
                "preview": (
                    "Уважаемый гость!\n"
                    "Сердечно приглашаем Вас на суннат той сына {child_name}. "
                    "Разделите с нами семейную радость этого дня.\n"
                    "{event_date}, в {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
    },
    "birthday": {
        "uz-latn": [
            {
                "title": "Klassik",
                "preview": (
                    "Assalomu alaykum!\n"
                    "{person_name} ning tugʻilgan kunini nishonlashga "
                    "Sizni samimiy taklif etamiz. "
                    "Bayram kayfiyatini birga ulashaylik!\n"
                    "{event_date}, soat {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Samimiy",
                "preview": (
                    "Aziz doʻstimiz!\n"
                    "{person_name} uchun tugʻilgan kun dasturxoniga "
                    "Sizni kutamiz. Kelib, tabrikingizni ayting va quvonchga sherik boʻling.\n"
                    "{event_date}, soat {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "uz-cyrl": [
            {
                "title": "Классик",
                "preview": (
                    "Ассалому алайкум!\n"
                    "{person_name} нинг туғилган кунини нишонлашга "
                    "Сизни самимий таклиф этамиз. "
                    "Байрам кайфиятини бирга улашайлик!\n"
                    "{event_date}, соат {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Самимий",
                "preview": (
                    "Азиз дўстимиз!\n"
                    "{person_name} учун туғилган кун дастурхонига "
                    "Сизни кутамиз. Келиб, табригингизни айтинг ва қувончга шерик бўлинг.\n"
                    "{event_date}, соат {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "ru": [
            {
                "title": "Классика",
                "preview": (
                    "Здравствуйте!\n"
                    "Приглашаем Вас отметить день рождения {person_name}. "
                    "Будем рады разделить праздничное настроение вместе!\n"
                    "{event_date}, в {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Тёплое",
                "preview": (
                    "Дорогой друг!\n"
                    "Ждём Вас за праздничным столом в честь дня рождения {person_name}. "
                    "Приходите с пожеланиями и хорошим настроением!\n"
                    "{event_date}, в {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
    },
    "hudoyi": {
        "uz-latn": [
            {
                "title": "Klassik",
                "preview": (
                    "Assalomu alaykum!\n"
                    "Xudoga shukronalik bildirish maqsadida uyushtirilgan "
                    "hudoyi dasturxoniga Sizni taklif etamiz. "
                    "Kelib, duo qiling va oshimizdan bahra oling.\n"
                    "{event_date}, soat {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Samimiy",
                "preview": (
                    "Hurmatli mehmonimiz!\n"
                    "Oilamizning hudoyi oshiga Sizni chin dildan chorlaymiz. "
                    "Marhamat qilib, suhbatimizga va duolarimizga qoʻshiling.\n"
                    "{event_date}, soat {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "uz-cyrl": [
            {
                "title": "Классик",
                "preview": (
                    "Ассалому алайкум!\n"
                    "Худога шукроналик билдириш мақсадида уюштирилган "
                    "худойи дастурхонига Сизни таклиф этамиз. "
                    "Келиб, дуо қилинг ва ошимиздан баҳра олинг.\n"
                    "{event_date}, соат {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Самимий",
                "preview": (
                    "Ҳурматли меҳмонимиз!\n"
                    "Оиламизнинг худойи ошига Сизни чин дилдан чорлаймиз. "
                    "Марҳамат қилиб, суҳбатимизга ва дуоларимизга қўшилинг.\n"
                    "{event_date}, соат {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "ru": [
            {
                "title": "Классика",
                "preview": (
                    "Ассаламу алейкум!\n"
                    "Приглашаем Вас на худои — дастархан благодарности Всевышнему. "
                    "Приходите разделить с нами молитву и угощение.\n"
                    "{event_date}, в {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Тёплое",
                "preview": (
                    "Уважаемый гость!\n"
                    "От всей души приглашаем Вас на семейный худои-ош. "
                    "Будем рады Вашему присутствию, беседе и добрым молитвам.\n"
                    "{event_date}, в {event_time}\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
    },
    "hayit": {
        "uz-latn": [
            {
                "title": "Klassik",
                "preview": (
                    "Assalomu alaykum!\n"
                    "{hayit_occasion} munosabati bilan Sizni "
                    "oilaviy dasturxonimizga taklif etamiz. "
                    "Bayram tabrigini birga aytsam, deymiz.\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Samimiy",
                "preview": (
                    "Hurmatli mehmonimiz!\n"
                    "Hayitingiz muborak boʻlsin! Oilamizning {hayit_occasion} "
                    "ziyofatiga Sizni kutamiz — kelib, bayram quvonchini baham koʻring.\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "uz-cyrl": [
            {
                "title": "Классик",
                "preview": (
                    "Ассалому алайкум!\n"
                    "{hayit_occasion} муносабати билан Сизни "
                    "оилавий дастурхонимизга таклиф этамиз. "
                    "Байрам табригини бирга айтсак, деймиз.\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Самимий",
                "preview": (
                    "Ҳурматли меҳмонимиз!\n"
                    "Ҳайтингиз муборак бўлсин! Оиламизнинг {hayit_occasion} "
                    "зиёфатига Сизни кутамиз — келиб, байрам қувончини баҳам кўринг.\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
        "ru": [
            {
                "title": "Классика",
                "preview": (
                    "Ассаламу алейкум!\n"
                    "По случаю праздника {hayit_occasion} приглашаем Вас "
                    "за наш семейный дастархан. "
                    "Будем рады вместе обменяться поздравлениями.\n"
                    "{venue_name}, {venue_address}"
                ),
            },
            {
                "title": "Тёплое",
                "preview": (
                    "Уважаемый гость!\n"
                    "С праздником {hayit_occasion}! Ждём Вас на нашем праздничном "
                    "угощении — приходите разделить радость этого дня.\n"
                    "{venue_name}, {venue_address}"
                ),
            },
        ],
    },
}


def _template_variables(preview: str) -> list[str]:
    found = re.findall(r"\{([a-zA-Z0-9_]+)\}", preview or "")
    return sorted(set(found))



class Command(BaseCommand):
    help = "Seed MVP events, mood tags, text templates, AI presets"

    def handle(self, *args, **options):
        _ensure_media_templates()

        admin, _ = User.objects.get_or_create(
            telegram_id=1,
            defaults={
                "first_name": "System",
                "role": Role.ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )

        for item in EVENTS:
            active = bool(item.get("is_active", True))
            event, _ = EventConfig.objects.update_or_create(
                slug=item["slug"],
                defaults={
                    "sort_order": item["sort_order"],
                    "name_translations": item["name_translations"],
                    "description_translations": {},
                    "subtypes": item.get("subtypes") or [],
                    "fields_schema": item["fields_schema"],
                    "color_themes": {},
                    "is_active": active,
                },
            )

            rich = _load_ready_texts().get(item["slug"]) or {}
            texts = rich if rich else TEXT_BY_EVENT.get(item["slug"], {})
            keep_titles: set[str] = set()
            for lang, payloads in texts.items():
                variants = payloads if isinstance(payloads, list) else [payloads]
                for idx, payload in enumerate(variants):
                    title = payload["title"]
                    preview = payload.get("preview") or payload.get("preview_text") or ""
                    keep_titles.add(title)
                    TextTemplate.objects.update_or_create(
                        event=event,
                        language=lang,
                        title=title,
                        defaults={
                            "preview_text": preview,
                            "variables_used": _template_variables(preview),
                            "tone": "classic" if idx == 0 else "warm",
                            "sort_order": idx,
                            "is_active": active,
                            "created_by_admin": admin,
                        },
                    )
            if keep_titles:
                TextTemplate.objects.filter(event=event, is_active=True).exclude(
                    title__in=keep_titles
                ).update(is_active=False)

            assets = TEMPLATE_ASSETS[item["slug"]]
            keep_theme_names: set[str] = set()
            for idx, asset in enumerate(assets):
                keep_theme_names.add(asset["theme_name"])
                Template.objects.update_or_create(
                    event=event,
                    theme_name=asset["theme_name"],
                    defaults={
                        "bg_url": asset["bg_url"],
                        "bg_url_preview": asset["bg_url_preview"],
                        "ai_composition_prompt": asset["composition"],
                        "supports_dark_text": True,
                        "supported_formats": ["4:5", "9:16", "1:1"],
                        "style_tags": asset["tags"],
                        "color_palette": asset["palette"],
                        "is_active": active,
                        "is_featured": active and idx == 0,
                        "created_by_admin": admin,
                    },
                )

            # Keep only the quality themes for this event.
            Template.objects.filter(event=event).exclude(
                theme_name__in=keep_theme_names
            ).update(is_active=False, is_featured=False)

            primary = assets[0]
            AIPromptPreset.objects.update_or_create(
                name=f"{item['slug']} luxury",
                event=event,
                defaults={
                    "base_prompt": (
                        f"Create a premium print-ready Uzbek {item['slug']} taklifnoma, "
                        "stationery quality. Visual style: {mood_snippets}. "
                        f"Event-specific look: {primary['composition']} "
                        "Full-bleed card, refined florals and metallic accents, never cartoonish. "
                        "Large sharp readable typography. No watermark or logo."
                    ),
                    "negative_prompt": (
                        "blurry/misspelled text, invented dates, watermark, logo, "
                        "faces, neon, purple glow, comic, florals covering text, "
                        "generic identical layout for every event type"
                    ),
                    "model_params": {"aspect_ratio": "4:5"},
                    "is_active": active,
                },
            )

        for i, (slug, category, snippet, names) in enumerate(MOOD_TAGS):
            MoodTag.objects.update_or_create(
                slug=slug,
                defaults={
                    "category": category,
                    "name_translations": names,
                    "prompt_snippet": snippet,
                    "sort_order": i,
                    "is_active": True,
                },
            )

        # Hard-remove junk JPG templates (demos, placeholders, broken uploads).
        from django.db.models import Q

        junk_q = (
            Q(theme_name__istartswith="Demo ")
            | Q(theme_name__iendswith=" Classic")
            | Q(
                theme_name__in=[
                    "Ivory Classic",
                    "Cream Gold Roses",
                    "Rose Blush Minimal",
                    "Ivory Atelier",
                    "Black luxury",
                ]
            )
            | Q(bg_url__icontains="placehold.co")
            | Q(bg_url_preview__icontains="placehold.co")
            | Q(bg_url="ur")
            | Q(bg_url_preview="ur")
        )
        deleted, _ = (
            Template.objects.filter(junk_q)
            .exclude(theme_name__in=KEEP_THEME_NAMES)
            .delete()
        )
        # Also remove any other inactive leftovers not in the quality set.
        extra, _ = (
            Template.objects.filter(is_active=False)
            .exclude(theme_name__in=KEEP_THEME_NAMES)
            .delete()
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed data ready ({len(KEEP_THEME_NAMES)} quality themes; "
                f"removed {deleted + extra} junk templates)"
            )
        )