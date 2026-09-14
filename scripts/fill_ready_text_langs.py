#!/usr/bin/env python3
"""Add uz-cyrl (translit) and ru (meaning-matched) copies of rich invitation texts."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "frontend/src/data/readyTexts.json"

DIGRAPHS = [
    ("o‘", "ў"),
    ("oʻ", "ў"),
    ("o'", "ў"),
    ("o`", "ў"),
    ("O‘", "Ў"),
    ("Oʻ", "Ў"),
    ("O'", "Ў"),
    ("O`", "Ў"),
    ("g‘", "ғ"),
    ("gʻ", "ғ"),
    ("g'", "ғ"),
    ("g`", "ғ"),
    ("G‘", "Ғ"),
    ("Gʻ", "Ғ"),
    ("G'", "Ғ"),
    ("G`", "Ғ"),
    ("sh", "ш"),
    ("Sh", "Ш"),
    ("SH", "Ш"),
    ("ch", "ч"),
    ("Ch", "Ч"),
    ("CH", "Ч"),
    ("yo", "ё"),
    ("Yo", "Ё"),
    ("YO", "Ё"),
    ("yu", "ю"),
    ("Yu", "Ю"),
    ("YU", "Ю"),
    ("ya", "я"),
    ("Ya", "Я"),
    ("YA", "Я"),
    ("ye", "е"),
    ("Ye", "Е"),
    ("YE", "Е"),
    ("ng", "нг"),
    ("Ng", "Нг"),
    ("NG", "НГ"),
]

SINGLES = {
    "a": "а",
    "A": "А",
    "b": "б",
    "B": "Б",
    "d": "д",
    "D": "Д",
    "e": "е",
    "E": "Е",
    "f": "ф",
    "F": "Ф",
    "g": "г",
    "G": "Г",
    "h": "ҳ",
    "H": "Ҳ",
    "i": "и",
    "I": "И",
    "j": "ж",
    "J": "Ж",
    "k": "к",
    "K": "К",
    "l": "л",
    "L": "Л",
    "m": "м",
    "M": "М",
    "n": "н",
    "N": "Н",
    "o": "о",
    "O": "О",
    "p": "п",
    "P": "П",
    "q": "қ",
    "Q": "Қ",
    "r": "р",
    "R": "Р",
    "s": "с",
    "S": "С",
    "t": "т",
    "T": "Т",
    "u": "у",
    "U": "У",
    "v": "в",
    "V": "В",
    "x": "х",
    "X": "Х",
    "y": "й",
    "Y": "Й",
    "z": "з",
    "Z": "З",
}


def latn_to_cyrl(text: str) -> str:
    placeholders: list[str] = []

    def hold(match: re.Match) -> str:
        placeholders.append(match.group(0))
        return f"\x00{len(placeholders) - 1}\x00"

    out = re.sub(r"\{[a-zA-Z0-9_]+\}", hold, text)
    i, chars, n = 0, [], len(out)
    while i < n:
        if out[i] == "\x00":
            j = out.find("\x00", i + 1)
            chars.append(out[i : j + 1])
            i = j + 1
            continue
        hit = False
        for src, dst in DIGRAPHS:
            if out.startswith(src, i):
                chars.append(dst)
                i += len(src)
                hit = True
                break
        if hit:
            continue
        ch = out[i]
        prev = chars[-1] if chars else ""
        word_start = (not prev) or prev[-1] in " \n\t.,;:—–-!()[]\"'«»"
        if ch in ("e", "E") and word_start:
            chars.append("э" if ch == "e" else "Э")
            i += 1
            continue
        if ch in SINGLES:
            chars.append(SINGLES[ch])
            i += 1
            continue
        if ch in "'’ʻ`" and chars and chars[-1] not in {" ", "\n", "—", "–", ",", ".", "!"}:
            chars.append("ъ")
            i += 1
            continue
        chars.append(ch)
        i += 1
    result = "".join(chars)
    for idx, raw in enumerate(placeholders):
        result = result.replace(f"\x00{idx}\x00", raw)
    return result


HEADER_RU = {
    "Hurmatli va e’zozli mehmonimiz!": "Уважаемый и дорогой наш гость!",
    "Muhtaram va qadrli mehmonlar!": "Досточтимые и дорогие гости!",
    "Aziz va mehribon yaqinlarimiz!": "Дорогие и родные наши!",
    "Qadrdon va e’zozli mehmonimiz!": "Дорогой и уважаемый наш гость!",
    "Qadrli va muhtaram mehmonimiz!": "Дорогой и досточтимый наш гость!",
    "Bismillahir Rohmanir Rohim.": "Бисмилляхи р-рахмани р-рахим.",
    "Bismillahir Rohmanir Rohim. Aziz va qadrdon dindoshimiz!": "Бисмилляхи р-рахмани р-рахим. Дорогой наш собрат по вере!",
    "Aziz mehmonimiz!": "Дорогой наш гость!",
    "Qadrli do‘stlar va qadrdonlar!": "Дорогие друзья и близкие!",
    "Muhtaram va qadrli mehmonimiz!": "Досточтимый и дорогой наш гость!",
}

CLOSING_RU = {
    "Yuksak ehtirom ila, {family_signature}": "С глубоким уважением, {family_signature}",
    "Samimiy ehtirom bilan, {family_signature}": "С искренним почтением, {family_signature}",
    "Qalbimizdagi cheksiz mehr ila, {family_signature}": "С безграничной любовью в сердце, {family_signature}",
    "Chuqur samimiyat va ehtirom bilan, {family_signature}": "С искренностью и глубоким уважением, {family_signature}",
    "Tashkilotchilar oilasi": "Семья организаторов",
    "Xayrli duolar va ehtirom ila, {family_signature}": "С добрыми молитвами и уважением, {family_signature}",
    "Ehtirom ila, {family_signature}": "С уважением, {family_signature}",
    "Samimiyat va ehtirom ila, {family_signature}": "С теплотой и уважением, {family_signature}",
    "Samimiyat va ehtirom ila, {person_name}": "С теплотой и уважением, {person_name}",
    "Yuksak ehtirom va e’zoz ila, {family_signature}": "С глубоким почтением и уважением, {family_signature}",
}

BODY_RU = {
    "Sizni va oila a’zolaringizni xonadonimizdagi qutlug‘ ayyom — farzandlarimizning muqaddas nikoh to‘yi munosabati bilan yozilayotgan shukuhli dasturxonimizga taklif etamiz. Ushbu quvonchli va mas’uliyatli onlarda yonimizda bo‘lib, yoshlarimizning baxtiyor kelajagiga ezgu tilaklar bildirishingiz biz uchun ulkan sharafdir.": "Приглашаем Вас и Вашу семью за наш торжественный дастархан по случаю священного никаха наших детей. Для нас высокая честь, что в эти радостные и ответственные минуты Вы будете рядом и пожелаете молодым счастливого будущего.",
    "Ikki qalbning muqaddas nikoh rishtalari ila tutashuvi va yangi oila poydevori qo‘yilishi munosabati bilan yozilgan ushbu taklifnomamizni samimiyat ila qabul qilgaysiz. Yoshlarimizning mustaqil hayot bo‘sag‘asiga qo‘yayotgan ilk qadamlarida guvoh bo‘lib, chiroyli duolaringiz bilan davramiz fayzini oshirishingizni so‘raymiz.": "Просим с теплотой принять это приглашение по случаю священного союза двух сердец и начала новой семьи. Будем благодарны, если Вы станете свидетелями первых шагов молодых во взрослую жизнь и украсите наш круг своими добрыми молитвами.",
    "Baxtli kunlar quvonchi eng qadrli insonlar bilan baham ko‘rilgandagina mukammal bo‘ladi. Hayotimizdagi eng go‘zal va hayajonli tantana — qalbimizdagi samimiy mehr hamda shukronalikni Siz azizlar bilan bo‘lishishni istaymiz. Shunday unutilmas kunda yonimizda bo‘lishingiz bizga cheksiz baxt bag‘ishlaydi.": "Радость счастливых дней становится полной, лишь когда ею делятся с самыми дорогими людьми. Мы хотим разделить с Вами самое прекрасное и волнующее торжество нашей жизни — искреннюю любовь и благодарность наших сердец. Ваше присутствие в этот незабываемый день подарит нам безграничное счастье.",
    "Oila — bu qalb harorati, ehtirom va samimiyat maskani. Nikoh to‘yimiz munosabati bilan tashkil etilayotgan ushbu iliq va samimiy kechada aynan Sizning ishtirokingiz biz uchun juda muhimdir. Keling, birgalikda eng go‘zal xotiralarni yarataylik va ushbu kunga unutilmas shukuh ulashaylik!": "Семья — это тепло сердца, уважение и искренность. На этом тёплом вечере по случаю нашего никаха Ваше присутствие особенно важно для нас. Приходите: вместе создадим самые прекрасные воспоминания и наполним этот день незабываемым торжеством!",
    "Oilamiz tarixidagi eng sharafli va shodiyona kun — nikoh to‘yi tantanasi munosabati bilan Sizni ushbu shukuhli kechaga taklif etamiz. Tashrifingiz xonadonimizga buyuk fayz, to‘yimizga esa haqiqiy tantanavor shukuh bag‘ishlaydi. Ezgu niyat va oq tilaklaringiz bilan kelib, quvonchimizga sherik bo‘ling!": "Приглашаем Вас на этот торжественный вечер по случаю самого почётного и радостного дня в истории нашей семьи — свадьбы-никаха. Ваш визит принесёт дому благодать, а торжеству — истинное великолепие. Приходите с добрыми намерениями и светлыми пожеланиями и разделите нашу радость!",
    "Yaratganning inoyati va hikmati ila ikki yoshning nikoh to‘yi munosabati bilan yozilgan ushbu taklifimizni qabul qilgaysiz. Ushbu xayrli va barakali kunda to‘kin dasturxonimiz atrofida jam bo‘lib, yoshlarimiz haqiga chiroyli duolar qilishingiz hamda quvonchimizga sherik bo‘lishingizni so‘raymiz.": "Просим принять это приглашение по случаю никаха двух молодых, дарованного милостью и мудростью Всевышнего. В этот благой и благословенный день просим собраться у щедрого дастархана, вознести добрые молитвы за молодых и разделить нашу радость.",
    "Hayotimizdagi eng go‘zal va mas’uliyatli kun — nikoh to‘yimizda Sizni ko‘rishdan behad mamnun bo‘lamiz. Quvonchli onlarda yonimizda bo‘ling va baxtimizni birga nishonlang!": "Будем безмерно рады видеть Вас в самый прекрасный и ответственный день нашей жизни — на нашем никахе. Будьте рядом в минуты радости и отпразднуйте наше счастье вместе!",
    "Hayotimizning eng hayajonli va yangi sahifasi ochilmoqda! Ushbu unutilmas, quvnoq hamda samimiy oqshomni Siz kabi qadrli insonlar davrasida o‘tkazishni istaymiz. Tashrif buyuring, chiroyli xotiralar va ajoyib kayfiyatni birgalikda yarataylik!": "Открывается самая волнующая новая страница нашей жизни! Этот незабываемый, весёлый и тёплый вечер мы хотим провести в кругу таких дорогих людей, как Вы. Приходите: вместе создадим прекрасные воспоминания и чудесное настроение!",
    "Oilalarimiz tarixidagi eng sharafli va unutilmas ayyom — muqaddas nikoh rishtalarining tutashuvidir. Ushbu shukuhli tantanada Sizning ishtirokingiz biz uchun shunchaki ehtirom emas, balki baxtimizning mukammalligidir. Ezgu niyat va samimiy tilaklaringiz ila davramiz ko‘rkiga ko‘rk bag‘ishlashingizni chin qalbimizdan so‘raymiz.": "Самый почётный и незабываемый день в истории наших семей — соединение священных уз никаха. Ваше присутствие на этом торжестве для нас не просто уважение, а полнота нашего счастья. От всего сердца просим украсить наш круг добрыми намерениями и искренними пожеланиями.",
    "Sizni va oila a’zolaringizni xonadonimizdagi qutlug‘ ayyom munosabati bilan yozilayotgan nahorga osh dasturxonimizga taklif etamiz. Ushbu xayrli va shukuhli tongda mehmonimiz bo‘lib, to‘kin dasturxonimiz fayzini oshirishingizni so‘raymiz.": "Приглашаем Вас и Вашу семью за дастархан утреннего плова по случаю священного дня в нашем доме. Просим быть нашими гостями в это благое и торжественное утро и приумножить благодать щедрого стола.",
    "Xonadonimizda bo‘lib o‘tadigan to‘y tantanasi munosabati bilan yozilgan nahorga osh taklifnomamizni qabul qilgaysiz. Ertalabki fayzli davramizda ishtirok etib, yoshlarimiz kelajagiga ezgu tilaklar bildirishingiz biz uchun ulkan sharafdir.": "Просим принять приглашение на утренний плов по случаю свадебного торжества в нашем доме. Для нас высокая честь, если Вы присоединитесь к утреннему кругу и пожелаете молодым светлого будущего.",
    "Qalbimizdagi samimiy mehr va shukronalik bilan Sizni nahorgi osh dasturxonimizga chorlaymiz. Hayotimizdagi quvonchli onlarni Siz kabi qadrli insonlar bilan baham ko‘rish bizga cheksiz mamnuniyat bag‘ishlaydi. Qutlug‘ tongda yonimizda bo‘ling!": "С искренней любовью и благодарностью в сердце приглашаем Вас за дастархан утреннего плова. Делить радостные минуты жизни с такими дорогими людьми, как Вы, — безграничная радость для нас. Будьте рядом в это благословенное утро!",
    "Oila quvonchi yaqinlar jam bo‘lgandagina to‘liq bo‘ladi. To‘yimiz munosabati bilan yozilayotgan elga osh dasturxonida aynan Sizning ishtirokingiz biz uchun juda muhim. Keling, ertalabki fayzli suhbatda birga bo‘laylik va unutilmas xotiralar ulashaylik!": "Семейная радость становится полной, когда собираются близкие. На дастархане плова для гостей по случаю нашей свадьбы Ваше присутствие особенно важно. Приходите: вместе проведём благодатное утро и поделимся незабываемыми воспоминаниями!",
    "Oilamiz tarixidagi eng sharafli va shodiyona kun munosabati bilan Sizni nahorga osh marosimiga taklif etamiz. Tashrifingiz xonadonimizga buyuk fayz, to‘yimizga esa haqiqiy tantanavor shukuh bag‘ishlaydi. Ezgu niyatlaringiz bilan kelib, quvonchimizga sherik bo‘ling!": "Приглашаем Вас на утренний плов по случаю самого почётного и радостного дня в истории нашей семьи. Ваш визит принесёт дому благодать, а свадьбе — истинное торжество. Приходите с добрыми намерениями и разделите нашу радость!",
    "Yaratganning inoyati ila to‘yimiz munosabati bilan yozilgan nahorga osh taklifimizni samimiyat bilan qabul qilgaysiz. Ushbu muborak va xayrli tongda to‘kin dasturxonimiz atrofida jam bo‘lib, yoshlarimiz haqiga chiroyli duolar qilishingiz hamda quvonchimizga sherik bo‘lishingizni so‘raymiz.": "Просим с теплотой принять приглашение на утренний плов по случаю нашей свадьбы, дарованной милостью Всевышнего. В это благословенное утро просим собраться у щедрого дастархана, вознести добрые молитвы за молодых и разделить нашу радость.",
    "Xonadonimizdagi to‘y munosabati bilan yozilayotgan nahorga osh dasturxonimizda Sizni ko‘rishdan behad mamnun bo‘lamiz. Qutlug‘ tongda kutib qolamiz!": "Будем безмерно рады видеть Вас за дастарханом утреннего плова по случаю свадьбы в нашем доме. Ждём Вас в это благословенное утро!",
    "To‘yimizning eng fayzli va jo‘shqin qismi — nahorga osh marosimida barchangizni kutamiz! Erta tongdan ko‘tarinki kayfiyat, samimiy gurung va do‘stona davrada birga bo‘laylik. Tashrifingizni intizorlik bilan kutamiz!": "Ждём всех Вас на самой благодатной и оживлённой части нашей свадьбы — утреннем плове! С самого утра будем вместе: в приподнятом настроении, в тёплой беседе и дружеском кругу. С нетерпением ждём Вашего визита!",
    "Oilalarimiz tarixidagi eng sharafli va unutilmas ayyom munosabati bilan Sizni nahorgi el oshiga taklif etamiz. Ushbu shukuhli tantanada Sizning ishtirokingiz biz uchun shunchaki ehtirom emas, balki baxtimizning mukammalligidir. Oq tilaklaringiz ila davramiz ko‘rkiga ko‘rk bag‘ishlashingizni chin qalbimizdan so‘raymiz.": "Приглашаем Вас на утренний плов для гостей по случаю самого почётного и незабываемого дня в истории наших семей. Ваше присутствие на этом торжестве для нас не просто уважение, а полнота нашего счастья. От всего сердца просим украсить наш круг светлыми пожеланиями.",
    "Xonadonimizda bo‘lib o‘tadigan to‘y tantanalari oldidan tashkil etilayotgan maslahat oshiga Sizni taklif etamiz. Tajribangiz, qimmatli maslahatlaringiz va ezgu tilaklaringiz bilan to‘yimiz tayyorgarligida yonimizda bo‘lishingiz biz uchun ulkan sharafdir.": "Приглашаем Вас на плов-маслахат перед свадебными торжествами в нашем доме. Для нас высокая честь, если Вы будете рядом на подготовке к свадьбе — с Вашим опытом, ценными советами и добрыми пожеланиями.",
    "Farzandlarimizning nikoh to‘yi munosabati bilan yozilayotgan maslahat oshi dasturxonimizga taklif etamiz. To‘y tashvishlari va tayyorgarlik ishlarini maslahatlashib olish uchun oqsoqollarimiz va yaqinlarimiz davrasida mehmonimiz bo‘lishingizni so‘raymiz.": "Приглашаем за дастархан плова-маслахат по случаю никаха наших детей. Просим быть нашими гостями в кругу аксакалов и близких, чтобы вместе обсудить заботы и подготовку к свадьбе.",
    "To‘y — bu nafaqat quvonch, balki yaqinlarning hamjihatligidir. Xonadonimizdagi to‘y oldidan yozilayotgan maslahat oshida Siz azizlarni ko‘rishdan behad mamnun bo‘lamiz. Kelib, samimiy gurung va maslahatlaringiz bilan quvonchimizga sherik bo‘ling.": "Свадьба — это не только радость, но и согласие близких. Будем безмерно рады видеть Вас на плове-маслахат перед торжеством в нашем доме. Приходите и разделите нашу радость тёплой беседой и советами.",
    "Kattalarning duo va maslahati olingan ishda hamisha baraka bo‘ladi. To‘yimiz oldidan tashkil etilayotgan maslahat oshida aynan Sizning ishtirokingiz biz uchun juda muhim. Dasturxonimiz atrofida jam bo‘lib, to‘yimizni tartibli va fayzli o‘tkazishda fikrlaringizni baham ko‘rishingizni so‘raymiz.": "В деле, освящённом молитвой и советом старших, всегда есть благословение. На плове-маслахат перед свадьбой Ваше присутствие особенно важно. Просим собраться у дастархана и поделиться мыслями, чтобы провести торжество чинно и благодатно.",
    "Oilamizdagi shukuhli ayyom — bo‘lajak nikoh to‘yi munosabati bilan barcha yaqinlar va el-yurt faollarini maslahat oshiga taklif etamiz. Tashrifingiz xonadonimizga fayz, to‘yimiz tayyorgarligiga esa tartib va baraka bag‘ishlaydi.": "По случаю славного дня нашей семьи — предстоящего никаха — приглашаем всех близких и уважаемых людей на плов-маслахат. Ваш визит принесёт дому благодать, а подготовке к свадьбе — порядок и баракат.",
    "Xonadonimizdagi to‘y tantanalari xayrli va barakali o‘tishi uchun yozilgan maslahat oshi dasturxonimizga taklif etamiz. Ezgu niyatlar bilan to‘planib, bo‘lajak to‘yimiz haqiga chiroyli duolar qilishingiz hamda maslahatlaringiz bilan ko‘maklashishingizni so‘raymiz.": "Приглашаем за дастархан плова-маслахат, чтобы свадебные торжества в нашем доме прошли благостно и с баракатом. Просим собраться с добрыми намерениями, вознести молитвы за предстоящую свадьбу и помочь советом.",
    "Xonadonimizdagi to‘y oldidan yozilayotgan maslahat oshiga taklif etamiz. Dasturxonimiz atrofida Sizni ko‘rishdan behad mamnun bo‘lamiz!": "Приглашаем на плов-маслахат перед свадьбой в нашем доме. Будем безмерно рады видеть Вас у нашего дастархана!",
    "To‘yimiz tayyorgarligining eng mas’uliyatli va muhim bosqichi — maslahat oshida barchangizni kutamiz! Samimiy gurung, vazifalarni bo‘lishib olish va ko‘tarinki kayfiyatda birga bo‘laylik.": "Ждём всех Вас на самом ответственном этапе подготовки к свадьбе — плове-маслахат! Вместе поговорим по душам, распределим дела и проведём время в приподнятом настроении.",
    "Oilamiz tarixidagi eng sharafli va unutilmas ayyom oldidan yozilayotgan maslahat oshida Sizning ishtirokingiz biz uchun yuksak izzatdir. Hayotiy tajribangiz, qimmatli maslahatlaringiz hamda duolaringiz ila to‘yimiz fayzini oshirishingizni chin qalbimizdan so‘raymiz.": "Ваше присутствие на плове-маслахат перед самым почётным и незабываемым днём нашей семьи — высокая честь для нас. От всего сердца просим приумножить благодать свадьбы Вашим жизненным опытом, ценными советами и молитвами.",
    "Sizni va oila a’zolaringizni xonadonimizdagi qutlug‘ ayyom — farzandimizning Sunnat to‘yi munosabati bilan yozilayotgan shukuhli dasturxonimizga taklif etamiz. Ushbu quvonchli kunda mehmonimiz bo‘lib, to‘kin dasturxonimiz fayzini oshirishingizni so‘raymiz.": "Приглашаем Вас и Вашу семью за наш торжественный дастархан по случаю суннат тоя нашего ребёнка. Просим быть нашими гостями в этот радостный день и приумножить благодать щедрого стола.",
    "Dilbandimizning Sunnat to‘yi munosabati bilan yozilgan ushbu taklifnomamizni samimiyat ila qabul qilgaysiz. Yoshimizning mustaqil hayot sari qo‘yayotgan ilk ildam qadamlarida guvoh bo‘lib, chiroyli duolaringiz bilan davramiz fayzini oshirishingizni so‘raymiz.": "Просим с теплотой принять это приглашение по случаю суннат тоя нашего любимого ребёнка. Будем благодарны, если Вы станете свидетелями его первых уверенных шагов во взрослую жизнь и украсите наш круг добрыми молитвами.",
    "Qalbimizdagi cheksiz shukronalik va mehr bilan Sizni farzandimizning Sunnat to‘yi tantanasiga chorlaymiz. Hayotimizdagi eng go‘zal va quvonchli onlarni Siz kabi qadrli insonlar bilan baham ko‘rish bizga olam-olam mamnuniyat bag‘ishlaydi. Shunday unutilmas kunda yonimizda bo‘ling!": "С безграничной благодарностью и любовью в сердце приглашаем Вас на торжество суннат тоя нашего ребёнка. Делить самые прекрасные и радостные минуты жизни с такими дорогими людьми, как Вы, — огромная радость. Будьте рядом в этот незабываемый день!",
    "Oila quvonchi va farzand kutilgan baxti yaqinlar jam bo‘lgandagina to‘liq bo‘ladi. Xonadonimizdagi Sunnat to‘yi dasturxonida aynan Sizning ishtirokingiz biz uchun juda muhim. Keling, ushbu fayzli davramizda jam bo‘lib, go‘zal xotiralar ulashaylik!": "Семейная радость и счастье ребёнка становятся полными, когда собираются близкие. На дастархане суннат тоя в нашем доме Ваше присутствие особенно важно. Приходите: вместе проведём этот благодатный круг и поделимся прекрасными воспоминаниями!",
    "Oilamizdagi shukuhli tantana — farzandimizning Sunnat to‘yi munosabati bilan Sizni ushbu qutlug‘ kecha/dasturxonga taklif etamiz. Tashrifingiz xonadonimizga buyuk fayz, bayramimizga esa haqiqiy tantanavor shukuh bag‘ishlaydi. Ezgu niyatlaringiz bilan kelib, quvonchimizga sherik bo‘ling!": "Приглашаем Вас на это благословенное торжество по случаю суннат тоя нашего ребёнка. Ваш визит принесёт дому благодать, а празднику — истинное великолепие. Приходите с добрыми намерениями и разделите нашу радость!",
    "Sunnati nabaviyga muvofiq, farzandimizning Sunnat to‘yi munosabati bilan yozilgan dasturxonimizga Sizni taklif etamiz. Ushbu muborak va xayrli kunda jam bo‘lib, jajji farzandimiz haqqiga chiroyli duolar qilishingiz hamda quvonchimizga sherik bo‘lishingizni so‘raymiz.": "Согласно сунне Пророка приглашаем Вас за дастархан по случаю суннат тоя нашего ребёнка. В этот благословенный день просим собраться, вознести добрые молитвы за нашего малыша и разделить нашу радость.",
    "Farzandimizning Sunnat to‘yi munosabati bilan yozilayotgan dasturxonimizda Sizni ko‘rishdan behad mamnun bo‘lamiz. Quvonchli onlarda yonimizda bo‘ling va baxtimizga sherik bo‘ling!": "Будем безмерно рады видеть Вас за дастарханом по случаю суннат тоя нашего ребёнка. Будьте рядом в минуты радости и разделите наше счастье!",
    "Qahramonimizning mard yig‘it bo‘lib ulg‘ayishi yolida o‘tkazilayotgan Sunnat to‘yida barchangizni kutamiz! Samimiy kayfiyat, yaxshi gurung va do‘stona davrada birga bo‘laylik. Tashrifingizni intizorlik bilan kutib qolamiz!": "Ждём всех Вас на суннат тое нашего героя — на пути его взросления в доблестного юношу! Вместе проведём время в тёплом настроении, доброй беседе и дружеском кругу. С нетерпением ждём Вашего визита!",
    "Oilamiz tarixidagi eng sharafli va unutilmas ayyom — farzandimizning Sunnat to‘yi munosabati bilan Sizni shukuhli el dasturxoniga taklif etamiz. Ushbu qutlug‘ tantanada Sizning ishtirokingiz biz uchun yuksak ehtirom va baxtimizning mukammalligidir. Oq tilaklaringiz ila davramiz ko‘rkiga ko‘rk bag‘ishlashingizni chin qalbimizdan so‘raymiz.": "Приглашаем Вас за торжественный дастархан по случаю самого почётного и незабываемого дня в истории нашей семьи — суннат тоя нашего ребёнка. Ваше присутствие на этом благословенном торжестве — высокая честь и полнота нашего счастья. От всего сердца просим украсить наш круг светлыми пожеланиями.",
    "Sizni va oila a’zolaringizni xonadonimizdagi qutlug‘ ayyom — {person_name}ning tug‘ilgan kuni munosabati bilan yozilayotgan shukuhli dasturxonimizga taklif etamiz. Ushbu quvonchli kunda mehmonimiz bo‘lib, davramiz fayzini oshirishingizni so‘raymiz.": "Приглашаем Вас и Вашу семью за наш торжественный дастархан по случаю дня рождения {person_name}. Просим быть нашими гостями в этот радостный день и приумножить благодать нашего круга.",
    "Qadrli {person_name}ning tavallud ayyomi munosabati bilan yozilgan ushbu taklifnomamizni samimiyat ila qabul qilgaysiz. Fayzli va samimiy davramizda ishtirok etib, chiroyli tilaklaringiz bilan quvonchimizga sherik bo‘lishingizni so‘raymiz.": "Просим с теплотой принять это приглашение по случаю дня рождения дорогого {person_name}. Просим присоединиться к благодатному и искреннему кругу и разделить нашу радость своими добрыми пожеланиями.",
    "Umrning har bir yili va har bir fasli yaqinlar davrasida go‘zaldir. Qalbimizdagi samimiy mehr bilan Sizni tavallud ayyomimizni birgalikda nishonlashga chorlaymiz. Hayotimizdagi quvonchli onlarni Siz kabi qadrli insonlar bilan baham ko‘rish bizga cheksiz mamnuniyat bag‘ishlaydi.": "Каждый год и каждый сезон жизни прекрасен в кругу близких. С искренней любовью в сердце приглашаем Вас вместе отметить день рождения. Делить радостные минуты жизни с такими дорогими людьми, как Вы, — безграничная радость для нас.",
    "Bayram quvonchi va shukuhli onlar yaqinlar jam bo‘lgandagina mukammal bo‘ladi. Tug‘ilgan kun munosabati bilan yozilayotgan ushbu dasturxonda aynan Sizning ishtirokingiz biz uchun juda muhim. Keling, ushbu fayzli davramizda jam bo‘lib, go‘zal xotiralar ulashaylik!": "Праздничная радость становится полной, когда собираются близкие. На этом дастархане по случаю дня рождения Ваше присутствие особенно важно. Приходите: вместе проведём этот благодатный круг и поделимся прекрасными воспоминаниями!",
    "Oilamizning ardoqli insoni — {person_name}ning qutlug‘ yubiley tavallud ayyomi munosabati bilan Sizni ushbu tantanali kechaga taklif etamiz. Tashrifingiz xonadonimizga buyuk fayz, bayramimizga esa haqiqiy shukuh bag‘ishlaydi. Ezgu niyatlaringiz bilan kelib, quvonchimizga sherik bo‘ling!": "Приглашаем Вас на этот торжественный вечер по случаю юбилея дорогого человека нашей семьи — {person_name}. Ваш визит принесёт дому благодать, а празднику — истинное великолепие. Приходите с добрыми намерениями и разделите нашу радость!",
    "Yaratganning bergan umr ne’matiga shukronalik ramzi o‘laroq, {person_name}ning tavallud ayyomi munosabati bilan yozilgan dasturxonimizga Sizni taklif etamiz. Ushbu xayrli kunda jam bo‘lib, chiroyli duolar qilishingiz hamda quvonchimizga sherik bo‘lishingizni so‘raymiz.": "В знак благодарности за дар жизни от Всевышнего приглашаем Вас за дастархан по случаю дня рождения {person_name}. В этот благой день просим собраться, вознести добрые молитвы и разделить нашу радость.",
    "{person_name}ning tug‘ilgan kuni munosabati bilan yozilayotgan dasturxonimizda Sizni ko‘rishdan behad mamnun bo‘lamiz. Quvonchli onlarda yonimizda bo‘ling!": "Будем безмерно рады видеть Вас за дастарханом по случаю дня рождения {person_name}. Будьте рядом в минуты радости!",
    "Yanada tajribali, quvnoq va baxtli bo‘lgan bir yoshimni nishonlaymiz! Ushbu unutilmas oqshomda barchangizni kutaman. Ajoyib kayfiyat, jo‘shqin gurunglar va unutilmas xotiralar bilan boyitilgan kechada birga bo‘laylik!": "Отмечаем ещё один год — более опытный, весёлый и счастливый! Жду всех Вас в этот незабываемый вечер. Вместе проведём ночь в отличном настроении, оживлённых разговорах и незабываемых воспоминаниях!",
    "Oilamiz tarixidagi shukuhli va unutilmas ayyom — {person_name}ning tavallud ayyomi munosabati bilan Sizni go‘zal bayram oqshomiga taklif etamiz. Ushbu qutlug‘ tantanada Sizning ishtirokingiz biz uchun yuksak ehtirom va bayramimizning mukammalligidir. Oq tilaklaringiz ila davramiz ko‘rkiga ko‘rk bag‘ishlashingizni chin qalbimizdan so‘raymiz.": "Приглашаем Вас на прекрасный праздничный вечер по случаю дня рождения {person_name} — славного и незабываемого дня в истории нашей семьи. Ваше присутствие на этом благословенном торжестве — высокая честь и полнота праздника. От всего сердца просим украсить наш круг светлыми пожеланиями.",
    "Sizni va oila a’zolaringizni xonadonimizda yozilayotgan ehson dasturxoni — Hudoyi marosimiga taklif etamiz. Ushbu xayrli va shukuhli gurungda mehmonimiz bo‘lib, dasturxonimiz fayzini oshirishingizni so‘raymiz.": "Приглашаем Вас и Вашу семью на дастархан эхсона — обряд худои в нашем доме. Просим быть нашими гостями в этой благой и торжественной беседе и приумножить благодать стола.",
    "Xonadonimizda tashkil etilayotgan Hudoyi marosimi munosabati bilan yozilgan ushbu taklifnomamizni samimiyat ila qabul qilgaysiz. Fayzli davramizda ishtirok etib, biz bilan birga bo‘lishingiz biz uchun ulkan sharafdir.": "Просим с теплотой принять это приглашение по случаю обряда худои в нашем доме. Для нас высокая честь, если Вы присоединитесь к благодатному кругу и будете вместе с нами.",
    "Qalbimizdagi samimiy mehr va shukronalik bilan Sizni Hudoyi dasturxonimizga chorlaymiz. Yaxshi kunlarimizda va xayrli amallarda Siz kabi qadrli insonlar bilan birga bo‘lish bizga cheksiz mamnuniyat bag‘ishlaydi. Qutlug‘ davramizda yonimizda bo‘ling!": "С искренней любовью и благодарностью в сердце приглашаем Вас за дастархан худои. Быть вместе с такими дорогими людьми, как Вы, в добрые дни и благих делах — безграничная радость. Будьте рядом в нашем благословенном кругу!",
    "Xonadonimizda yozilayotgan ehson dasturxonida aynan Sizning ishtirokingiz biz uchun juda muhim. Keling, ushbu fayzli davramizda jam bo‘lib, samimiy va chiroyli suhbatlar atrofida birga bo‘laylik.": "На дастархане эхсона в нашем доме Ваше присутствие особенно важно. Приходите: вместе проведём этот благодатный круг в тёплых и прекрасных беседах.",
    "Oilamiz tomonidan tashkil etilayotgan Hudoyi marosimi munosabati bilan Sizni ushbu dasturxonga taklif etamiz. Tashrifingiz xonadonimizga buyuk fayz va baraka bag‘ishlaydi. Dasturxonimiz atrofida mehmon bo‘lishingizni so‘raymiz.": "Приглашаем Вас за этот дастархан по случаю обряда худои, устроенного нашей семьёй. Ваш визит принесёт дому великую благодать и баракат. Просим быть гостем у нашего стола.",
    "Yaratganning roziligi yo‘lida va o‘tganlarimiz yodi uchun yozilgan Hudoyi dasturxonimizga Sizni taklif etamiz. Ushbu muborak va xayrli kunda jam bo‘lib, o‘tganlarimiz haqqiga tilovatlar va chiroyli duolar qilishingiz hamda ehsonimizga sherik bo‘lishingizni so‘raymiz.": "Приглашаем Вас за дастархан худои во имя довольства Всевышнего и в память об ушедших. В этот благословенный день просим собраться, вознести тиляваты и добрые молитвы за ушедших и разделить наш эхсон.",
    "Xonadonimizda yozilayotgan Hudoyi marosimi munosabati bilan dasturxonimizda Sizni ko‘rishdan behad mamnun bo‘lamiz. Fayzli gurungimizda kutib qolamiz!": "Будем безмерно рады видеть Вас за дастарханом по случаю обряда худои в нашем доме. Ждём Вас в нашей благодатной беседе!",
    "Xonadonimizda bo‘lib o‘tadigan Hudoyi marosimi va ehson dasturxonida barchangizni kutamiz! Samimiy gurung va do‘stona davrada birga bo‘laylik. Tashrifingizni intizorlik bilan kutib qolamiz.": "Ждём всех Вас на обряде худои и дастархане эхсона в нашем доме! Вместе проведём время в тёплой беседе и дружеском кругу. С нетерпением ждём Вашего визита.",
    "Xonadonimizda tashkil etilayotgan Hudoyi va ehson marosimi munosabati bilan Sizni shukuhli dasturxonimizga taklif etamiz. Ushbu xayrli davrada Sizning ishtirokingiz biz uchun yuksak ehtirom va davramizning mukammalligidir. Chin qalbimizdan taklif etib qolamiz.": "Приглашаем Вас за торжественный дастархан по случаю обряда худои и эхсона в нашем доме. Ваше присутствие в этом благом кругу — высокая честь и полнота нашего собрания. Приглашаем от всего сердца.",
    "Sizni va oila a’zolaringizni xonadonimizdagi quvonchli ayyom — farzandimizning Aqiqa marosimi munosabati bilan yozilayotgan shukuhli dasturxonimizga taklif etamiz. Ushbu xayrli tongda mehmonimiz bo‘lib, to‘kin dasturxonimiz fayzini oshirishingizni so‘raymiz.": "Приглашаем Вас и Вашу семью за наш торжественный дастархан по случаю радостного дня в нашем доме — обряда акика нашего ребёнка. Просим быть нашими гостями в это благое утро и приумножить благодать щедрого стола.",
    "Xonadonimizga in’om etilgan ilohiy ne’mat — dilbandimizning Aqiqa to‘yi munosabati bilan yozilgan ushbu taklifnomamizni samimiyat ila qabul qilgaysiz. Fayzli davramizda ishtirok etib, jajji farzandimiz kelajagiga ezgu tilaklar bildirishingiz biz uchun ulkan sharafdir.": "Просим с теплотой принять это приглашение по случаю акики нашего любимого ребёнка — божественного дара нашему дому. Для нас высокая честь, если Вы присоединитесь к благодатному кругу и пожелаете малышу светлого будущего.",
    "Qalbimizdagi cheksiz shukronalik va mehr bilan Sizni farzandimizning Aqiqa marosimiga chorlaymiz. Hayotimizdagi eng go‘zal va quvonchli onlarni Siz kabi qadrli insonlar bilan baham ko‘rish bizga olam-olam mamnuniyat bag‘ishlaydi. Qutlug‘ davramizda yonimizda bo‘ling!": "С безграничной благодарностью и любовью в сердце приглашаем Вас на обряд акика нашего ребёнка. Делить самые прекрасные и радостные минуты жизни с такими дорогими людьми, как Вы, — огромная радость. Будьте рядом в нашем благословенном кругу!",
    "Oila quvonchi va farzand baxti yaqinlar jam bo‘lgandagina to‘liq bo‘ladi. Xonadonimizdagi Aqiqa dasturxonida aynan Sizning ishtirokingiz biz uchun juda muhim. Keling, ertalabki fayzli gurungda birga bo‘laylik va go‘zal xotiralar ulashaylik!": "Семейная радость и счастье ребёнка становятся полными, когда собираются близкие. На дастархане акики в нашем доме Ваше присутствие особенно важно. Приходите: вместе проведём благодатное утро и поделимся прекрасными воспоминаниями!",
    "Oilamizdagi shukuhli tantana — farzandimizning Aqiqa marosimi munosabati bilan Sizni ushbu qutlug‘ kecha/dasturxonga taklif etamiz. Tashrifingiz xonadonimizga buyuk fayz, bayramimizga esa haqiqiy tantanavor shukuh bag‘ishlaydi. Ezgu niyatlaringiz bilan kelib, quvonchimizga sherik bo‘ling!": "Приглашаем Вас на это благословенное торжество по случаю акики нашего ребёнка. Ваш визит принесёт дому благодать, а празднику — истинное великолепие. Приходите с добрыми намерениями и разделите нашу радость!",
    "Yaratganning inoyati va bergan ne’matiga shukronalik ramzi o‘laroq yozilgan farzandimizning Aqiqa dasturxoniga Sizni taklif etamiz. Ushbu muborak va xayrli kunda jam bo‘lib, jajji dilbandimizning haqqiga chiroyli duolar qilishingiz hamda quvonchimizga sherik bo‘lishingizni so‘raymiz.": "В знак благодарности за милость Всевышнего и дарованный нам дар приглашаем Вас за дастархан акики нашего ребёнка. В этот благословенный день просим собраться, вознести добрые молитвы за нашего малыша и разделить нашу радость.",
    "Farzandimizning Aqiqa marosimi munosabati bilan yozilayotgan dasturxonimizda Sizni ko‘rishdan behad mamnun bo‘lamiz. Quvonchli onlarda yonimizda bo‘ling!": "Будем безмерно рады видеть Вас за дастарханом по случаю акики нашего ребёнка. Будьте рядом в минуты радости!",
    "Oilamizning yangi va eng mitti a’zosi sharafiga yozilayotgan Aqiqa dasturxonida barchangizni kutamiz! Samimiy kayfiyat, yaxshi gurung va do‘stona davrada birga bo‘laylik. Tashrifingizni intizorlik bilan kutib qolamiz!": "Ждём всех Вас за дастарханом акики в честь нового и самого крошечного члена нашей семьи! Вместе проведём время в тёплом настроении, доброй беседе и дружеском кругу. С нетерпением ждём Вашего визита!",
    "Oilamizga in’om etilgan muqaddas ne’mat — farzandimizning Aqiqa to‘yi munosabati bilan Sizni shukuhli el oshiga taklif etamiz. Ushbu qutlug‘ tantanada Sizning ishtirokingiz biz uchun yuksak ehtirom va baxtimizning mukammalligidir. Oq tilaklaringiz ila davramiz ko‘rkiga ko‘rk bag‘ishlashingizni chin qalbimizdan so‘raymiz.": "Приглашаем Вас за торжественный дастархан по случаю акики нашего ребёнка — священного дара нашей семье. Ваше присутствие на этом благословенном торжестве — высокая честь и полнота нашего счастья. От всего сердца просим украсить наш круг светлыми пожеланиями.",
}


def translate_block(latn: dict) -> dict:
    header = latn["header"]
    body = latn["body"]
    closing = latn["closing"]
    if header not in HEADER_RU:
        raise SystemExit(f"Missing RU header: {header}")
    if closing not in CLOSING_RU:
        raise SystemExit(f"Missing RU closing: {closing}")
    if body not in BODY_RU:
        raise SystemExit(f"Missing RU body ({len(body)} chars): {body[:80]}")
    return {
        "uz-latn": latn,
        "uz-cyrl": {
            "header": latn_to_cyrl(header),
            "body": latn_to_cyrl(body),
            "closing": latn_to_cyrl(closing),
        },
        "ru": {
            "header": HEADER_RU[header],
            "body": BODY_RU[body],
            "closing": CLOSING_RU[closing],
        },
    }


def fill_tree(node):
    if not isinstance(node, dict):
        return node
    if set(node.keys()) <= {"uz-latn", "uz-cyrl", "ru"} and "uz-latn" in node:
        latn = node["uz-latn"]
        if isinstance(latn, dict) and "header" in latn:
            return translate_block(latn)
        return node
    return {k: fill_tree(v) for k, v in node.items()}


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    if "nikohBySubtype" in data:
        data["nikohBySubtype"] = fill_tree(data["nikohBySubtype"])
    if "eventByStyle" in data:
        data["eventByStyle"] = fill_tree(data["eventByStyle"])
    SRC.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("updated", SRC)


if __name__ == "__main__":
    main()
