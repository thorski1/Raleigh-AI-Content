import type { ReactNode } from "react";
import { EndpointsContext } from "./agent";

export default function RootLayout(props: { children: ReactNode }) {
  return <EndpointsContext>{props.children}</EndpointsContext>;
}
