interface Props {
  done: boolean;
}

export function LoadingScreen({ done }: Props) {
  return (
    <div className={`loading-screen${done ? ' loading-screen--done' : ''}`}>
      <div className="loading-content">
        <div className="loading-globe">🌍</div>
        <h1 className="loading-title">Voyage Culturel</h1>
        <p className="loading-subtitle">Découvre les cultures du monde entier</p>
        <div className="loading-bar">
          <div className="loading-bar-fill" />
        </div>
        <p className="loading-hint">Appuie sur une touche pour commencer</p>
      </div>
    </div>
  );
}
