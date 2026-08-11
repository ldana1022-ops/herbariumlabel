import { formatDate, type Specimen } from "@/lib/specimens";

const DOTS = "....................................................................";

function Row({ label, value, fill }: { label: string; value?: string | null; fill?: boolean }) {
  const text = value && String(value).trim().length > 0 ? String(value) : null;
  return (
    <div className="label-row">
      <span className="label-key">{label}</span>{" "}
      {text ? (
        <span className="label-value">{text}</span>
      ) : fill ? (
        <span className="label-dots">{DOTS}</span>
      ) : (
        <span className="label-dots">.................</span>
      )}
    </div>
  );
}

function ScientificName({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const binomial = parts.slice(0, 2).join(" ");
  const authority = parts.slice(2).join(" ");
  return (
    <span className="label-value">
      <em>{binomial}</em>
      {authority ? <span className="font-semibold"> {authority}</span> : null}
    </span>
  );
}

export function HerbariumLabel({ specimen }: { specimen: Specimen }) {
  return (
    <div className="herbarium-label" dir="ltr" lang="en">
      <div className="herbarium-label-inner">
        <div className="herbarium-label-head">
          <div className="head-line-1">FLORA OF SAUDIA ARABIA KINGDOM</div>
          <div className="head-line-2">
            HERBARIUM OF NATIONAL CENTER FOR VEGETATION COVER
            <br />
            DEVELOPMENT AND COMBATING DESERTIFICATION
          </div>
        </div>
        <div className="herbarium-label-body">
          <div className="label-row">
            <span className="label-key">Scientific Name:</span>{" "}
            <ScientificName name={specimen.scientific_name} />
          </div>
          <Row label="Family:" value={specimen.family} />
          <Row label="Local Name:" value={specimen.local_name} />
          <Row label="Locality:" value={specimen.locality} />
          <Row label="Region:" value={specimen.region} />
          <div className="label-row label-coords">
            <span>
              <span className="label-key">Lat (N):</span>{" "}
              <span className="label-value">{specimen.latitude ?? "........."}</span>
            </span>
            <span>
              <span className="label-key">Long (E):</span>{" "}
              <span className="label-value">{specimen.longitude ?? "........."}</span>
            </span>
            <span>
              <span className="label-key">Alt.:</span>{" "}
              <span className="label-value">
                {specimen.altitude_m !== null && specimen.altitude_m !== undefined
                  ? `${specimen.altitude_m} m`
                  : "..........m"}
              </span>
            </span>
          </div>
          <Row label="Collection Date:" value={formatDate(specimen.collection_date)} />
          <Row label="Collector (s):" value={specimen.collectors} />
          <Row label="Det.:" value={specimen.determination} fill />
          <Row label="Determined By:" value={specimen.determined_by} fill />
          <Row label="Determination Date:" value={formatDate(specimen.determination_date)} fill />
          <Row label="Notes:" value={specimen.notes} fill />
          <div className="label-accession">{specimen.accession_number}</div>
        </div>
      </div>
    </div>
  );
}