import { redirect } from "next/navigation";

export default function StudentCartRoute() {
  redirect("/student?tab=cart");
}

