// Decaid's 202 Accepted replies (advanced machine settings, resets) carry a JSON
// content type and an empty body. response.json() on those throws "Unexpected end
// of JSON input" after the write has already reached the machine.
export const parseJsonBody = <T>(text: string): T | undefined => text.trim() ? JSON.parse(text) as T : undefined
