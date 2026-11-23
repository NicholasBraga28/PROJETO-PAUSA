import { QRCodeSVG } from "qrcode.react";
import { Button } from "react-aria-components";
import { checkInUrl } from "./check-in-url";
import type { RoomSummary } from "./api";

interface RoomsResultsProps {
  rooms: RoomSummary[];
  origin: string;
  printRoomId: string | null;
  onRegenerate: (room: RoomSummary) => void;
  onPrint: (roomId: string) => void;
}

interface RoomQrProps {
  room: RoomSummary;
  origin: string;
}

function RoomQr({ room, origin }: RoomQrProps) {
  return (
    <div className="hr-room-qr">
      <QRCodeSVG
        value={checkInUrl(room.checkInToken, origin)}
        title={`QR Code de check-in da ${room.name}`}
        size={180}
        level="M"
        marginSize={4}
      />
      <p>Aponte a câmera do celular para fazer check-in nesta sala.</p>
    </div>
  );
}

function RoomCard({
  room,
  origin,
  onRegenerate,
  onPrint,
}: Omit<RoomsResultsProps, "rooms" | "printRoomId"> & { room: RoomSummary }) {
  return (
    <li className="hr-room-card">
      <h3>{room.name}</h3>
      <dl>
        <div>
          <dt>Unidade</dt>
          <dd>{room.locationName}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`hr-room-status ${room.active ? "is-active" : "is-inactive"}`}>
              {room.active ? "Ativa" : "Inativa"}
            </span>
          </dd>
        </div>
      </dl>
      {room.active ? (
        <>
          <div className="hr-room-check-in">
            <h4>Check-in</h4>
            <RoomQr room={room} origin={origin} />
          </div>
          <div className="hr-room-actions">
            <Button
              className="ghost-btn"
              aria-label={`Regenerar QR Code da ${room.name}`}
              onPress={() => onRegenerate(room)}
            >
              Regenerar QR Code
            </Button>
            <Button
              className="ghost-btn"
              aria-label={`Imprimir QR Code da ${room.name}`}
              onPress={() => onPrint(room.id)}
            >
              Imprimir QR Code
            </Button>
          </div>
        </>
      ) : (
        <p className="hr-help">QR indisponível para sala inativa.</p>
      )}
    </li>
  );
}

function PrintSheet({ room, origin, isTarget }: { room: RoomSummary; origin: string; isTarget: boolean }) {
  return (
    <article className="hr-room-print-sheet" data-print-target={isTarget}>
      <h1>{room.name}</h1>
      <p>Unidade: {room.locationName}</p>
      <QRCodeSVG
        value={checkInUrl(room.checkInToken, origin)}
        title={`QR Code de check-in da ${room.name}`}
        size={280}
        level="M"
        marginSize={4}
        aria-hidden="true"
      />
      <p>Aponte a câmera do celular para fazer check-in nesta sala.</p>
    </article>
  );
}

export function RoomsResults({ rooms, origin, printRoomId, onRegenerate, onPrint }: RoomsResultsProps) {
  if (rooms.length === 0) return <p className="hr-empty">Nenhuma sala encontrada.</p>;

  return (
    <>
      <ul className="hr-rooms-list" aria-label="Salas cadastradas">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} origin={origin} onRegenerate={onRegenerate} onPrint={onPrint} />
        ))}
      </ul>
      <div className="hr-room-print-area" aria-hidden={printRoomId === null}>
        {rooms.map((room) => (
          <PrintSheet key={room.id} room={room} origin={origin} isTarget={room.id === printRoomId} />
        ))}
      </div>
    </>
  );
}
