<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — getWeatherIcon() returns hardcoded SVG strings, no user input -->
<script lang="ts">
	import {
		getFlightConditions,
		getRfConditions,
		getWeatherCondition,
		type WeatherData
	} from './weather-helpers';

	interface Props {
		weather: WeatherData;
	}

	let { weather }: Props = $props();

	let tempF = $derived(Math.round((weather.temperature * 9) / 5 + 32));
	let tempC = $derived(Math.round(weather.temperature));
	let windMph = $derived((weather.windSpeed * 0.621371).toFixed(0));
	let visibilityMi = $derived(
		weather.pressure > 1013 && weather.humidity < 70
			? '10.0'
			: weather.humidity > 90
				? '2.0'
				: '6.0'
	);
</script>

<div class="popup">
	<div class="popup-header">
		<span class="popup-title">WEATHER</span>
	</div>
	<div class="popup-source">@ Open-Meteo — Local GPS</div>

	<div class="metric-header">
		<span class="metric-label">⌂ TEMPERATURE</span>
		<span class="metric-value">{tempF}°F / {tempC}°C</span>
	</div>

	<div class="row">
		<span class="key">Conditions</span>
		<span class="val">{getWeatherCondition(weather.weatherCode)}</span>
	</div>
	<div class="row">
		<span class="key">Wind</span>
		<span class="val">{windMph} mph {weather.windSpeed > 0 ? 'NW' : ''}</span>
	</div>
	<div class="row">
		<span class="key">Humidity</span>
		<span class="val">{weather.humidity}%</span>
	</div>
	<div class="row">
		<span class="key">Visibility</span>
		<span class="val">{visibilityMi} mi</span>
	</div>

	<div class="divider"></div>

	<div class="row">
		<span class="key">RF Conditions</span>
		<span
			class="val"
			class:accent={getRfConditions(weather).cls === 'accent'}
			class:warn={getRfConditions(weather).cls === 'warn'}
			>{getRfConditions(weather).label}</span
		>
	</div>
	<div class="row">
		<span class="key">Flight Conditions</span>
		<span
			class="val"
			class:accent={getFlightConditions(weather).cls === 'accent'}
			class:warn={getFlightConditions(weather).cls === 'warn'}
			>{getFlightConditions(weather).label}</span
		>
	</div>

	<div class="divider"></div>

	<div class="footer">
		<span class="footer-meta"
			>↑ {new Date().getHours().toString().padStart(2, '0')}:{new Date()
				.getMinutes()
				.toString()
				.padStart(2, '0')}</span
		>
		<span class="footer-meta"
			>↓ {(new Date().getHours() + 11).toString().padStart(2, '0')}:{new Date()
				.getMinutes()
				.toString()
				.padStart(2, '0')}</span
		>
		<button class="action-btn">↺ Refresh</button>
	</div>
</div>

<style>
	.popup {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		min-width: 260px;
		background: var(--cds-layer);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 6px;
		padding: 12px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
		z-index: 200;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.popup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0;
	}

	.popup-title {
		font-family: var(--cds-code-01-font-family);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--cds-text-helper);
	}

	.popup-source {
		font-family: var(--cds-code-01-font-family);
		font-size: 10px;
		color: var(--cds-text-helper);
		margin-bottom: 4px;
	}

	.metric-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
	}

	.metric-label {
		font-family: var(--cds-code-01-font-family);
		font-size: 10px;
		color: var(--cds-link-primary);
		letter-spacing: 0.5px;
	}

	.metric-value {
		font-family: var(--cds-code-01-font-family);
		font-size: 14px;
		font-weight: 600;
		color: var(--cds-text-primary);
	}

	.divider {
		height: 1px;
		background: var(--cds-border-subtle);
		margin: 2px 0;
	}

	.row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}

	.key {
		font-family: var(--cds-code-01-font-family);
		font-size: 11px;
		color: var(--cds-text-helper);
	}

	.val {
		font-family: var(--cds-code-01-font-family);
		font-size: 11px;
		color: var(--cds-text-primary);
		text-align: right;
	}

	.val.accent {
		color: var(--cds-support-success);
	}

	.val.warn {
		color: var(--cds-support-error);
	}

	.footer {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 2px;
	}

	.footer-meta {
		font-family: var(--cds-code-01-font-family);
		font-size: 10px;
		color: var(--cds-text-helper);
	}

	.action-btn {
		background: none;
		border: 1px solid var(--cds-border-subtle);
		border-radius: 4px;
		color: var(--cds-text-primary);
		font-family: var(--cds-code-01-font-family);
		font-size: 10px;
		padding: 2px 8px;
		cursor: pointer;
		margin-left: auto;
	}

	.action-btn:hover {
		background: var(--cds-layer-hover);
	}
</style>
