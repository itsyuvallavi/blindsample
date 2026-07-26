export function SecurityRail() {
  return (
    <ul className="security-rail" aria-label="BlindSample security controls">
      <li>
        <span>01</span>
        TLS ENCRYPTED
      </li>
      <li>
        <span>02</span>
        0G PRIVATE TEE
      </li>
      <li>
        <span>03</span>
        NO CSV STORAGE
      </li>
    </ul>
  );
}
