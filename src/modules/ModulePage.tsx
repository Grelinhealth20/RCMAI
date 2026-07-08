import './ModulePage.css'

interface ModulePageProps {
  name: string
}

function ModulePage({ name }: ModulePageProps) {
  return <div className="module-page" data-module={name} />
}

export default ModulePage
