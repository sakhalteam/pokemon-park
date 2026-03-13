import { useEffect, useRef } from 'react'
import type { ParkPokemon } from './types'

interface Props {
  pokemon: ParkPokemon
  onClose: () => void
  onTogglePin: () => void
}

/* ── type color map ──────────────────────────────────── */
const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878',
  fire: '#f08030',
  water: '#6890f0',
  electric: '#f8d030',
  grass: '#78c850',
  ice: '#98d8d8',
  fighting: '#c03028',
  poison: '#a040a0',
  ground: '#e0c068',
  flying: '#a890f0',
  psychic: '#f85888',
  bug: '#a8b820',
  rock: '#b8a038',
  ghost: '#705898',
  dragon: '#7038f8',
  dark: '#705848',
  steel: '#b8b8d0',
  fairy: '#ee99ac',
}

function formatHeight(dm: number): string {
  const totalInches = dm * 3.937
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return `${feet}'${inches.toString().padStart(2, '0')}"`
}

function formatWeight(hg: number): string {
  const lbs = (hg / 4.536).toFixed(1)
  return `${lbs} lbs`
}

function genderDisplay(rate: number): string {
  if (rate === -1) return 'Genderless'
  if (rate === 0) return '♂ only'
  if (rate === 8) return '♀ only'
  const femPct = (rate / 8) * 100
  return `♂ ${100 - femPct}% · ♀ ${femPct}%`
}

export default function PokemonCard({ pokemon, onClose, onTogglePin }: Props) {
  const { data } = pokemon
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Play cry on open
  useEffect(() => {
    if (data.cryUrl) {
      const audio = new Audio(data.cryUrl)
      audio.volume = 0.3
      audio.play().catch(() => {})
      audioRef.current = audio
    }
    return () => {
      audioRef.current?.pause()
    }
  }, [data.cryUrl])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const displayName = data.name.charAt(0).toUpperCase() + data.name.slice(1)

  return (
    <div className="card-overlay" onClick={onClose}>
      <div className="card-container" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button className="card-close" onClick={onClose}>✕</button>

        {/* Artwork */}
        <div className="card-artwork">
          <img src={data.artworkUrl} alt={displayName} />
          <button
            className="card-cry-btn"
            onClick={() => {
              if (data.cryUrl) {
                const a = new Audio(data.cryUrl)
                a.volume = 0.3
                a.play().catch(() => {})
              }
            }}
            title="Play cry"
          >
            🔊
          </button>
        </div>

        {/* Info */}
        <div className="card-info">
          <div className="card-name-row">
            <h2>{displayName}</h2>
            <span className="card-dex-num">#{String(data.id).padStart(3, '0')}</span>
          </div>

          {data.genus && <p className="card-genus">{data.genus}</p>}

          <div className="card-types">
            {data.types.map(t => (
              <span
                key={t}
                className="type-badge"
                style={{ backgroundColor: TYPE_COLORS[t] || '#888' }}
              >
                {t}
              </span>
            ))}
          </div>

          <p className="card-flavor">{data.flavorText}</p>

          <div className="card-stats">
            <div className="stat-row">
              <span className="stat-label">Height</span>
              <span>{formatHeight(data.height)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Weight</span>
              <span>{formatWeight(data.weight)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Gender</span>
              <span>{genderDisplay(data.genderRate)}</span>
            </div>
            {data.habitat && (
              <div className="stat-row">
                <span className="stat-label">Habitat</span>
                <span>{data.habitat}</span>
              </div>
            )}
          </div>

          <button
            className={`pin-btn ${pokemon.pinned ? 'pinned' : ''}`}
            onClick={onTogglePin}
          >
            📌 {pokemon.pinned ? 'Unpin from park' : 'Pin to park'}
          </button>
        </div>
      </div>
    </div>
  )
}
