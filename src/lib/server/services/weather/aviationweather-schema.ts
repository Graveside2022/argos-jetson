import { z } from 'zod';

// Upstream contract for https://aviationweather.gov/api/data/metar?format=json.
// Fields documented at https://aviationweather.gov/api/help.
// Only the fields we consume are listed; unknown keys are passed through.

export const AviationCloudSchema = z.object({
	cover: z.string().optional(),
	base: z.number().nullable().optional()
});

export const AviationMetarSchema = z.object({
	icaoId: z.string(),
	rawOb: z.string(),
	obsTime: z.number(),
	temp: z.number().nullable().optional(),
	dewp: z.number().nullable().optional(),
	wdir: z.union([z.number(), z.string()]).nullable().optional(),
	wspd: z.number().nullable().optional(),
	wgst: z.number().nullable().optional(),
	visib: z.union([z.number(), z.string()]).nullable().optional(),
	altim: z.number().nullable().optional(),
	clouds: z.array(AviationCloudSchema).optional(),
	wxString: z.string().nullable().optional()
});

export type AviationMetar = z.infer<typeof AviationMetarSchema>;

export const AviationMetarListSchema = z.array(AviationMetarSchema);
