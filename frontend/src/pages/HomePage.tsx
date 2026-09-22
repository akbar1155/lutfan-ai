import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SEO } from "../components/SEO";
import { getSEOConfig, getOrganizationSchema, getWebSiteSchema } from "../utils/seo";

const altTextMap: Record<string, Record<string, string>> = {
  nikoh: {
    'uz-latn': 'Nikoh taklifnomasi namunasi',
    'uz-cyrl': 'Никоҳ таклифномаси намунаси',
    'ru': 'Пример свадебного приглашения',
  },
  aqiqa: {
    'uz-latn': 'Aqiqa taklifnomasi namunasi',
    'uz-cyrl': 'Ақиқа таклифномаси намунаси',
    'ru': 'Пример приглашения на акыку',
  },
  birthday: {
    'uz-latn': 'Tug\'ilgan kun taklifnomasi namunasi',
    'uz-cyrl': 'Туғилган кун таклифномаси намунаси',
    'ru': 'Пример приглашения на день рождения',
  },
};

function LandingCard({
  slug,
  className,
  eager = false,
  language = 'uz-latn',
}: {
  slug: string;
  className: string;
  eager?: boolean;
  language?: string;
}) {
  const v = "v=8";
  const altText = altTextMap[slug]?.[language] || altTextMap[slug]?.['uz-latn'] || '';
  return (
    <picture>
      <source srcSet={`/landing-card-${slug}.webp?${v}`} type="image/webp" />
      <img
        className={className}
        src={`/landing-card-${slug}.jpg?${v}`}
        alt={altText}
        width={1200}
        height={1500}
        decoding="async"
        fetchPriority={eager ? "high" : "low"}
      />
    </picture>
  );
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currentLang = i18n.language || 'uz-latn';
  const seoConfig = getSEOConfig('home', currentLang);
  const structuredData = [getOrganizationSchema(), getWebSiteSchema()];

  return (
    <>
      <SEO
        {...seoConfig}
        path="/"
        structuredData={structuredData}
      />
      <main className="home">
        <div className="home-wrap">
          <section className="home-hero">
            <div className="home-hero-copy">
              <h1 className="home-brand">{t("heroText")}</h1>
              <p className="home-tagline">{t("tagline")}</p>
              <button type="button" className="cta home-cta" onClick={() => navigate("/create")}>
                {t("cta")}
              </button>
            </div>
            <div className="home-hero-stage" aria-hidden="true">
              <LandingCard slug="aqiqa" className="home-hero-card is-left" language={currentLang} />
              <LandingCard slug="nikoh" className="home-hero-card is-center" eager language={currentLang} />
              <LandingCard slug="birthday" className="home-hero-card is-right" language={currentLang} />
            </div>
          </section>

        <section className="section home-how">
          <h2>{t("how")}</h2>
          <ol className="how-flow">
            <li>
              <span className="how-num">01</span>
              <span>{t("howHome1")}</span>
            </li>
            <li>
              <span className="how-num">02</span>
              <span>{t("howHome2")}</span>
            </li>
            <li>
              <span className="how-num">03</span>
              <span>{t("howHome3")}</span>
            </li>
          </ol>
          <Link className="text-link" to="/how-it-works">
            {t("howMore")}
          </Link>
        </section>
        </div>
      </main>
    </>
  );
}
