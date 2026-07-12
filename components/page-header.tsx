export function PageHeader({
  titulo,
  acao,
}: {
  titulo: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h1 className="font-serif text-3xl text-primary">{titulo}</h1>
      {acao}
    </div>
  );
}
