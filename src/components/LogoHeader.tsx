type LogoHeaderProps = {
  compact?: boolean;
};

export function LogoHeader({ compact = false }: LogoHeaderProps) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <div className={compact ? "logo-lockup compact" : "logo-lockup"}>
      <img className="site-logo" src={`${basePath}/logo.svg`} alt="UCU BEDEN" />
    </div>
  );
}
