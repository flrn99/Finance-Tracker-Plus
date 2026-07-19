// logo.png trae padding transparente en los 4 lados (canvas 1920x1080, la
// marca real ocupa el rectángulo (77,268)-(1843,812) — 77px/4% a los costados,
// 268px/25% arriba y abajo). object-fit:cover NUNCA recorta los dos ejes a la
// vez (solo el que no coincide con el aspect-ratio del contenedor), así que
// deja el padding horizontal intacto y el logo queda corrido respecto al
// texto de abajo. Acá se recorta con posicionamiento absoluto — los 4 lados
// quedan exactos, así el borde izquierdo real del glifo cae justo en el
// borde del contenedor.
const NATIVE = { width: 1920, height: 1080 };
const CONTENT = { left: 77, top: 268, width: 1766, height: 544 };

export function LogoMark({ height, className }: { height: number; className?: string }) {
  const scale = height / CONTENT.height;
  return (
    <div
      className={className}
      style={{ position: "relative", height, width: CONTENT.width * scale, overflow: "hidden" }}
    >
      <img
        src="/logo.png"
        alt="Flow!"
        style={{
          position: "absolute",
          height: NATIVE.height * scale,
          width: NATIVE.width * scale,
          left: -CONTENT.left * scale,
          top: -CONTENT.top * scale,
          maxWidth: "none",
        }}
      />
    </div>
  );
}
