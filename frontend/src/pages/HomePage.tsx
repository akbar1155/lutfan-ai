import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

function LandingCard({
  slug,
  className,
  eager = false,
}: {
  slug: string;
  className: string;
  eager?: boolean;
}) {
  const v = "v=8";
  return (
    <picture>
      <source srcSet={`/landing-card-${slug}.webp?${v}`} type="image/webp" />
      <img
        className={className}
        src={`/landing-card-${slug}.jpg?${v}`}
        alt=""
        width={1200}
        height={1500}
        decoding="async"
        fetchPriority={eager ? "high" : "low"}
      />
    </picture>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
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
            <LandingCard slug="aqiqa" className="home-hero-card is-left" />
            <LandingCard slug="nikoh" className="home-hero-card is-center" eager />
            <LandingCard slug="birthday" className="home-hero-card is-right" />
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
  );
}
