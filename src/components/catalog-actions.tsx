"use client";
import { useActionState } from "react";
import { setCatalogStatus } from "@/app/actions/catalogo";

export function DeactivateCatalogItem({id,entity}:{id:number;entity:"producto"|"proveedor"}) {
  const [state, action, pending] = useActionState(setCatalogStatus,{message:""});
  return <form action={action}><input type="hidden" name="id" value={id}/><input type="hidden" name="entity" value={entity}/><button className="catalog-action danger" disabled={pending}>{pending?"…":"Desactivar"}</button>{state.message&&<small className={state.success?"table-note":"form-error"}>{state.message}</small>}</form>;
}
