/** One-second fixed-step snapshots acquire tiny floating-point clock errors. */
export function motionFrameDelay(from:number,to:number):number|undefined {
  const delay=(to-from)*1000;
  return Number.isFinite(delay)&&delay>0&&delay<=1000.001?Math.max(16,Math.min(1000,delay)):undefined;
}
