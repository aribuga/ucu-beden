export function SiteFooter({ showDedication }: { showDedication: boolean }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <footer className="site-footer">
      <img className="footer-logo" src={`${basePath}/footer-logo.svg`} alt="UCU BEDEN footer logo" />
      {showDedication ? <p>This site was made for Aslı Miuu &lt;33333 and exists for her.</p> : null}
    </footer>
  );
}
