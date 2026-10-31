/**
 * @iconify/react 的统一入口 —— React 侧图标请从这里导入，不要直接 `from '@iconify/react'`。
 *
 * 为什么需要这个壳：@iconify/react 的 <Icon> 是**运行时**从 api.unisvg.com 拉图标数据的。
 * 如果拉取失败（离线、代理、DNS 劣化），图标会留白，并且每页刷 console error。
 * 我们在构建期把用到的 68 个图标抽成本地注册表（iconify-offline.ts），但注册这个动作
 * 必须发生在任何 <Icon> 首次渲染之前 —— 否则组件会先发请求再等注册，白等一个超时。
 *
 * 做法：在本模块加载期（也就是 import 它的组件模块被求值时）就执行注册，
 * 时机严格早于该模块里任何组件的 render。之后再转发 @iconify/react 的全部导出，
 * 使用方代码一行不用改（只要把 import 来源换成 '@/lib/iconify-react'）。
 *
 * 换图标用法后跑一次：node ../.workbuddy/tools/gen-iconify-offline.mjs
 */
import './iconify-offline';

export * from '@iconify/react';
