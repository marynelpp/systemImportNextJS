"use client";
import { useActionState } from "react";
import { setCompanyStatus, updateCompanyDetails } from "@/app/actions/empresas";

export default function CompanyManagementForm({ company }: { company: { Id:number; NombreLegal:string; NombreComercial:string|null; Activa:boolean } }) {
  const [editState, editAction, editPending]=useActionState(updateCompanyDetails,{message:""});
  const [statusState,statusAction,statusPending]=useActionState(setCompanyStatus,{message:""});
  return <div className="company-management"><form action={editAction} className="inline-form"><input type="hidden" name="id" value={company.Id}/><label>Nombre legal<input name="legalName" defaultValue={company.NombreLegal} required/></label><label>Nombre comercial<input name="tradeName" defaultValue={company.NombreComercial??""}/></label><button className="catalog-action" disabled={editPending}>{editPending?"Guardando…":"Guardar"}</button>{editState.message&&<small className={editState.success?"form-message success":"form-message error"}>{editState.message}</small>}</form><form action={statusAction}><input type="hidden" name="id" value={company.Id}/><input type="hidden" name="active" value={company.Activa?"0":"1"}/><button className={`catalog-action ${company.Activa?"danger":""}`} disabled={statusPending}>{statusPending?"Guardando…":company.Activa?"Desactivar":"Activar"}</button>{statusState.message&&<small className={statusState.success?"form-message success":"form-message error"}>{statusState.message}</small>}</form></div>;
}
