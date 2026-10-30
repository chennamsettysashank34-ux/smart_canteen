import { redirect } from "next/navigation";

export default function StudentMenuRoute() {
  redirect("/student?tab=menu");
}

