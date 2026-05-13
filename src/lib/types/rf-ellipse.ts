// 95% confidence ellipse around a device's RF observations. Center +
// semi-major / semi-minor axes (meters) + rotation. Lives in types/ so the
// server-side computeDeviceEllipse, the client-side rfVisualization store,
// and the utils/ellipse-geometry GeoJSON converter all depend on a single
// shared shape rather than each redeclaring it.

export interface DeviceEllipse {
	centerLat: number;
	centerLon: number;
	semiMajorM: number;
	semiMinorM: number;
	/** Rotation of the semi-major axis from true east, in degrees (-90..90). */
	rotationDeg: number;
}
