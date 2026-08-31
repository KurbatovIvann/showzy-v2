export function Banner({ message }: { readonly message: string }) {
  return (
    <p role="alert" className="text-center text-[15px] font-medium text-danger">
      {message}
    </p>
  );
}
