export function SecurityRail() {
  return (
    <ul className="security-rail" aria-label="BlindSample security controls">
      <li>
        <span>[ok]</span>
        TLS TRANSIT
      </li>
      <li>
        <span>[ok]</span>
        0G PRIVATE TEE
      </li>
      <li>
        <span>[ok]</span>
        CSV NOT STORED
      </li>
    </ul>
  );
}
