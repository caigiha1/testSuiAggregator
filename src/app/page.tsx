import AftermathDataProvider from "./aftermath";
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export const dynamic = "force-dynamic";

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return <AftermathDataProvider searchParams={searchParams} />;
}
