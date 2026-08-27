import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <main className="home">
      <div className="home-wrap">
        <section className="home-hero">
          <div className="home-hero-copy">
            <h1 className="home-brand">{t("brand")}</h1>
            <p className="home-tagline">{t("tagline")}</p>
            <button type="button" className="cta home-cta" onClick={() => navigate("/create")}>
              {t("cta")}
            </button>
          </div>
          <div className="home-hero-stage">
            <img
              className="home-hero-art"
              src="/landing-hero.png"
              alt=""
              width={1463}
              height={817}
              decoding="async"
              fetchPriority="high"
            />
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
