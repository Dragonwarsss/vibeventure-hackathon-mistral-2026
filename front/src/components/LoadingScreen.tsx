interface Props {
  done: boolean;
}

export function LoadingScreen({ done }: Props) {
  return (
    <div className={`loading-screen${done ? ' loading-screen--done' : ''}`}>
      <div className="loading-content">
        <div className="loading-globe">🌍</div>
        <h1 className="loading-title">Cultural Journey</h1>
        <p className="loading-subtitle">Discover cultures from around the world</p>
        <div className="loading-bar">
          <div className="loading-bar-fill" />
        </div>
        <p className="loading-hint">Press any key to start</p>
      </div>
    </div>
  );
}
