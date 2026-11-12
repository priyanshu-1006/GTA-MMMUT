import "./home-screen.css";

export type HomeMode = "tour" | "play";

const gateImage = new URL("./assets/home/main-gate.webp", import.meta.url).href;
const tourImage = new URL("./assets/home/building-tour.webp", import.meta.url).href;
const playerImage = new URL("./assets/home/player-mode.webp", import.meta.url).href;

const modes = [
  {
    id: "play",
    title: "Play as a Player",
    description: "Walk, drive, and go inside campus buildings.",
    image: playerImage,
  },
  {
    id: "tour",
    title: "Building Tour",
    description: "Explore landmarks from dedicated camera views.",
    image: tourImage,
  },
] as const;

export function TeaserLink({ onClick }: { onClick?: () => void }) {
  return (
    <a className="teaser-link" href="https://youtu.be/8IXfY5gI-9Y" target="_blank" rel="noopener noreferrer"
      onClick={onClick}>
      Watch teaser
    </a>
  );
}

export function HomeScreen({ onSelect, onTeaserOpen }: { onSelect: (mode: HomeMode) => void; onTeaserOpen?: () => void }) {
  return (
    <main className="home-screen">
      <header className="home-header">
        <TeaserLink onClick={onTeaserOpen} />
        <span className="home-university">Madan Mohan Malaviya University of Technology</span>
        <span className="home-location">Gorakhpur, India</span>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <img className="home-hero-image" src={gateImage} alt="" fetchPriority="high" />
        <div className="home-hero-copy">
          <h1 id="home-title">GTA <span>MMMUT</span></h1>
          <p className="home-credit">Built by <strong>Priyanshu Chaurasia</strong></p>
          <p className="home-summary">A playable 3D recreation of the MMMUT campus.</p>
        </div>
      </section>

      <nav className="home-modes" aria-label="Choose a game mode">
        {modes.map(({ id, title, description, image }) => (
          <button
            className={`home-mode home-mode-${id}`}
            key={id}
            type="button"
            aria-label={title}
            aria-describedby={`home-mode-description-${id}`}
            onClick={() => onSelect(id)}
          >
            <img src={image} alt="" />
            <span className="home-mode-copy">
              <strong>{title}</strong>
              <span id={`home-mode-description-${id}`}>{description}</span>
            </span>
            <svg className="home-mode-arrow" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 12h14m-5.25-5.25L18.5 12l-5.25 5.25" />
            </svg>
          </button>
        ))}
      </nav>

      <footer className="home-footer">© 2026 Priyanshu Chaurasia</footer>
    </main>
  );
}
