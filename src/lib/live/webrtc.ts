/**
 * WHIP (enviar câmera) e WHEP (assistir) do Cloudflare Stream usando só as APIs do navegador.
 * Troca de SDP por HTTP: o navegador manda a oferta, a Cloudflare devolve a resposta (201 + Location).
 */
const ICE: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];

export class WebRtcError extends Error {
  constructor(readonly status: number) {
    super(`webrtc_${status}`);
  }
}

/** Espera os candidatos ICE (até 2 s) para mandar a oferta completa numa única requisição. */
function iceGathered(pc: RTCPeerConnection, timeoutMs = 2000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => pc.iceGatheringState === "complete" && done();
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

/** Faz a troca de SDP e devolve o endereço da sessão (para encerrar com DELETE). */
export async function negotiate(pc: RTCPeerConnection, endpoint: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  await pc.setLocalDescription(await pc.createOffer());
  await iceGathered(pc);
  const res = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: pc.localDescription?.sdp ?? "",
  });
  if (res.status !== 201 && res.status !== 200) throw new WebRtcError(res.status);
  const answer = await res.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });
  const location = res.headers.get("Location");
  return location ? new URL(location, endpoint).toString() : null;
}

export type WebRtcSession = { pc: RTCPeerConnection; stop: () => Promise<void> };

function session(pc: RTCPeerConnection, resource: string | null, fetcher: typeof fetch): WebRtcSession {
  return {
    pc,
    stop: async () => {
      pc.close();
      if (resource) await fetcher(resource, { method: "DELETE" }).catch(() => undefined);
    },
  };
}

/** Loja: envia a câmera e o microfone para o endereço WHIP da live. */
export async function publish(stream: MediaStream, whipUrl: string, fetcher: typeof fetch = fetch): Promise<WebRtcSession> {
  const pc = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: "max-bundle" });
  for (const track of stream.getTracks()) pc.addTransceiver(track, { direction: "sendonly" });
  try {
    return session(pc, await negotiate(pc, whipUrl, fetcher), fetcher);
  } catch (e) {
    pc.close();
    throw e;
  }
}

/** Quem assiste: recebe áudio e vídeo do endereço WHEP; `onStream` recebe o vídeo para o <video>. */
export async function play(whepUrl: string, onStream: (s: MediaStream) => void, fetcher: typeof fetch = fetch): Promise<WebRtcSession> {
  const pc = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: "max-bundle" });
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });
  const media = new MediaStream();
  pc.addEventListener("track", (e) => {
    media.addTrack(e.track);
    onStream(media);
  });
  try {
    return session(pc, await negotiate(pc, whepUrl, fetcher), fetcher);
  } catch (e) {
    pc.close();
    throw e;
  }
}
