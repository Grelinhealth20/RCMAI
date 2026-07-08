import type { FacilityProviderForm } from '../types'
import './stepForm.css'

interface FacilityProviderStepProps {
  value: FacilityProviderForm
  onChange: (next: FacilityProviderForm) => void
}

function FacilityProviderStep({ value, onChange }: FacilityProviderStepProps) {
  const update = (patch: Partial<FacilityProviderForm>) => onChange({ ...value, ...patch })

  return (
    <form className="ppf" onSubmit={(e) => e.preventDefault()} autoComplete="off">
      {/* ---------- Facility Information ---------- */}
      <fieldset className="ppf-card">
        <legend className="ppf-card-legend">
          <span className="ppf-card-dot" />
          Facility Information
        </legend>

        <div className="ppf-grid">
          <label className="ppf-field ppf-col-2">
            <span className="ppf-label">Facility Name</span>
            <input
              className="ppf-input"
              type="text"
              placeholder="e.g. Riverside Medical Center"
              value={value.facilityName}
              onChange={(e) => update({ facilityName: e.target.value })}
            />
          </label>

          <label className="ppf-field">
            <span className="ppf-label">Facility NPI</span>
            <input
              className="ppf-input"
              type="text"
              inputMode="numeric"
              placeholder="10-digit NPI"
              value={value.facilityNpi}
              onChange={(e) => update({ facilityNpi: e.target.value })}
            />
          </label>

          <label className="ppf-field">
            <span className="ppf-label">Tax ID (EIN)</span>
            <input
              className="ppf-input"
              type="text"
              placeholder="e.g. 12-3456789"
              value={value.taxId}
              onChange={(e) => update({ taxId: e.target.value })}
            />
          </label>

          <label className="ppf-field ppf-col-2">
            <span className="ppf-label">Facility Address</span>
            <textarea
              className="ppf-input ppf-textarea"
              rows={2}
              placeholder="Street, City, State ZIP"
              value={value.facilityAddress}
              onChange={(e) => update({ facilityAddress: e.target.value })}
            />
          </label>

          <label className="ppf-field ppf-col-2">
            <span className="ppf-label">Facility Phone Number</span>
            <input
              className="ppf-input"
              type="tel"
              placeholder="(XXX) XXX-XXXX"
              value={value.facilityPhone}
              onChange={(e) => update({ facilityPhone: e.target.value })}
            />
          </label>
        </div>
      </fieldset>

      {/* ---------- Provider Information ---------- */}
      <fieldset className="ppf-card">
        <legend className="ppf-card-legend">
          <span className="ppf-card-dot" />
          Provider Information
        </legend>

        <div className="ppf-subblock">
          <div className="ppf-subblock-head">
            <span className="ppf-card-dot" />
            Ordering Physician Details
          </div>

          <div className="ppf-grid">
            <label className="ppf-field ppf-col-2">
              <span className="ppf-label">Ordering Physician Name</span>
              <input
                className="ppf-input"
                type="text"
                placeholder="e.g. Dr. Sarah Lin"
                value={value.orderingPhysicianName}
                onChange={(e) => update({ orderingPhysicianName: e.target.value })}
              />
            </label>

            <label className="ppf-field ppf-col-2">
              <span className="ppf-label">Ordering Physician NPI</span>
              <input
                className="ppf-input"
                type="text"
                inputMode="numeric"
                placeholder="10-digit NPI"
                value={value.orderingPhysicianNpi}
                onChange={(e) => update({ orderingPhysicianNpi: e.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="ppf-subblock">
          <div className="ppf-subblock-head">
            <span className="ppf-card-dot" />
            Rendering Physician Details
          </div>

          <div className="ppf-grid">
            <label className="ppf-field ppf-col-2">
              <span className="ppf-label">Rendering Physician Name</span>
              <input
                className="ppf-input"
                type="text"
                placeholder="e.g. Dr. Marcus Reed"
                value={value.renderingPhysicianName}
                onChange={(e) => update({ renderingPhysicianName: e.target.value })}
              />
            </label>

            <label className="ppf-field ppf-col-2">
              <span className="ppf-label">Rendering Physician NPI</span>
              <input
                className="ppf-input"
                type="text"
                inputMode="numeric"
                placeholder="10-digit NPI"
                value={value.renderingPhysicianNpi}
                onChange={(e) => update({ renderingPhysicianNpi: e.target.value })}
              />
            </label>
          </div>
        </div>
      </fieldset>
    </form>
  )
}

export default FacilityProviderStep
