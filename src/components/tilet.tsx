/**
 * A thin woven band inspired by the geometric borders (tilet) of Ethiopian handwoven cloth,
 * rendered in brand colours. Decorative only.
 */
export function TiletBand() {
  return (
    <div aria-hidden className="h-3 w-full" style={{
      backgroundImage:
        "repeating-linear-gradient(90deg, #103D35 0 18px, #AEEA80 18px 24px, #103D35 24px 30px, #F7F8F4 30px 34px, #103D35 34px 52px, #AEEA80 52px 56px)",
    }} />
  );
}
