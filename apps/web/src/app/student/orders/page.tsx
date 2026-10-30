import { redirect } from "next/navigation";

export default function StudentOrdersRoute() {
  redirect("/student?tab=history");
}

