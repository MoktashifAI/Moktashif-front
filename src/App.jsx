import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./Components/Layout/Layout";
import Home from "./Components/Home/Home";
import NotFound from "./Components/NotFound/NotFound";
import Results from "./Components/Results/Results";
import SignIn_SignUp from "./Components/SignIn_SignUp/SignIn_SignUp";
import UserProfile from "./Components/UserProfile/UserProfile";
import ContactSupport from "./Components/ContactSupport/ContactSupport";
import ForgetPassword from "./Components/ForgetPassword/ForgetPassword";
import ScannerInput from "./Components/Scanner/ScannerInput";
let routers = createBrowserRouter([
  {
    path: '', element: <Layout />, children: [
      { index: true, element: <Home /> },
      { path: 'home', element: <Home /> },
      {path: 'scanner', element: <ScannerInput/>},
      { path: 'forgetpassword', element: <ForgetPassword /> },
      { path: 'results', element: <Results /> },
      {path: 'signin', element: <SignIn_SignUp />},
      { path: 'profile', element: <UserProfile /> },
      { path: '*', element: <NotFound /> },
      { path: 'contactsupport', element: < ContactSupport/> }
    ]
  }
]);

function App() {
  return <RouterProvider router={routers}></RouterProvider>
}

export default App
