const identity = `Edit the uploaded automobile photograph. Treat the input as the reference for the exact car: preserve make, model, color, body proportions, wheels, trim, badges and visible distinguishing details. Do not invent accessories, text, logos or watermarks. Produce one believable, high-quality automotive photograph. Keep the whole car in frame. Do not turn it into a different vehicle. Where the new angle reveals unseen details, use restrained plausible reconstruction consistent with the reference.`;

export const presets = {
  proshot: {
    label: 'Pro shot',
    prompt: `${identity} Create a premium automotive editorial photograph. Retain the reference camera angle and location character. Refine exposure, white balance, paint reflections and background distractions. Use soft directional studio-quality light, natural contrast and crisp realistic detail. The vehicle is stationary.`,
  },
  droneview: {
    label: 'Drone view',
    prompt: `${identity} Reframe as a cinematic drone photograph from an elevated three-quarter perspective, approximately 45 degrees above the vehicle. Show the roof, hood and surrounding ground. Keep the vehicle stationary and the surroundings coherent with the reference. Natural shadows and realistic perspective; no fisheye.`,
  },
  lowangle: {
    label: 'Low angle',
    prompt: `${identity} Reframe from a camera close to the ground at wheel-hub height, with a dramatic front three-quarter view and a moderate wide-angle lens. Emphasize the stance and sculpted body without stretching proportions. Keep the car stationary and the surroundings coherent with the reference.`,
  },
  rollingview: {
    label: 'Rolling view',
    prompt: `${identity} Create a realistic tracking photograph of this car driving along an empty closed road. Photograph from a parallel moving camera, three-quarter view. Keep the body sharply in focus, apply physically plausible rotational blur to the wheels and directional motion blur to road and background. No traffic, pedestrians, racing opponents or exaggerated speed effects.`,
  },
};
